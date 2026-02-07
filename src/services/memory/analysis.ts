/**
 * Memory Analysis Service
 * Analyzes embeddings to identify recurring themes and topics across journal entries
 */

import { cosineSimilarity } from './search';

/** Simplified embedding type for analysis (only needs id and vector) */
interface AnalysisEmbedding {
  id: string;
  vector: number[];
}

export interface ThemeCluster {
  /** Unique identifier for the cluster */
  id: string;
  /** Representative embedding IDs in this cluster */
  embeddingIds: string[];
  /** Centroid vector of the cluster */
  centroid: Float32Array;
  /** Average internal similarity within cluster */
  cohesion: number;
  /** Number of embeddings in the cluster */
  size: number;
}

export interface RecurringTheme {
  /** Theme identifier */
  id: string;
  /** Number of messages related to this theme */
  frequency: number;
  /** Average similarity within the theme */
  strength: number;
  /** Message IDs associated with this theme */
  messageIds: string[];
  /** Representative message ID (most central to theme) */
  representativeMessageId: string;
}

/**
 * Cluster embeddings using simple k-means-like algorithm
 * Groups similar embeddings together to identify recurring themes
 */
export function clusterEmbeddings(
  embeddings: AnalysisEmbedding[],
  numClusters: number = 5,
  maxIterations: number = 10
): ThemeCluster[] {
  if (embeddings.length === 0) {
    return [];
  }

  if (embeddings.length < numClusters) {
    // Not enough data to form requested clusters, create one cluster per embedding
    numClusters = embeddings.length;
  }

  // Initialize: randomly select k embeddings as initial centroids
  const initialIndices = selectRandomIndices(embeddings.length, numClusters);
  let centroids: Float32Array[] = initialIndices.map((idx) =>
    new Float32Array(embeddings[idx]!.vector)
  );

  let clusters: number[] = new Array(embeddings.length).fill(0);
  let converged = false;
  let iteration = 0;

  while (!converged && iteration < maxIterations) {
    // Assignment step: assign each embedding to nearest centroid
    const newClusters = embeddings.map((emb) => {
      const vector = new Float32Array(emb.vector);
      let maxSim = -1;
      let bestCluster = 0;

      centroids.forEach((centroid, clusterIdx) => {
        const sim = cosineSimilarity(vector, centroid);
        if (sim > maxSim) {
          maxSim = sim;
          bestCluster = clusterIdx;
        }
      });

      return bestCluster;
    });

    // Check convergence
    converged = newClusters.every((c, i) => c === clusters[i]);
    clusters = newClusters;

    if (!converged) {
      // Update step: recalculate centroids
      centroids = centroids.map((_, clusterIdx) => {
        const clusterMembers = embeddings.filter(
          (_, embIdx) => clusters[embIdx] === clusterIdx
        );

        if (clusterMembers.length === 0) {
          // Empty cluster, keep old centroid
          return centroids[clusterIdx]!;
        }

        // Calculate mean of all vectors in cluster
        const dim = clusterMembers[0]!.vector.length;
        const sum = new Float32Array(dim);

        clusterMembers.forEach((emb) => {
          emb.vector.forEach((val, i) => {
            sum[i] = (sum[i] || 0) + val;
          });
        });

        // Normalize
        const mean = new Float32Array(dim);
        const count = clusterMembers.length;
        for (let i = 0; i < dim; i++) {
          mean[i] = (sum[i] || 0) / count;
        }

        // Normalize to unit length
        return normalizeVector(mean);
      });
    }

    iteration++;
  }

  // Build cluster results
  const themeClusters: ThemeCluster[] = [];

  for (let clusterIdx = 0; clusterIdx < numClusters; clusterIdx++) {
    const clusterEmbeddings = embeddings.filter(
      (_, embIdx) => clusters[embIdx] === clusterIdx
    );

    if (clusterEmbeddings.length === 0) {
      continue; // Skip empty clusters
    }

    // Calculate cohesion (average pairwise similarity)
    let totalSim = 0;
    let pairCount = 0;

    for (let i = 0; i < clusterEmbeddings.length; i++) {
      for (let j = i + 1; j < clusterEmbeddings.length; j++) {
        const v1 = new Float32Array(clusterEmbeddings[i]!.vector);
        const v2 = new Float32Array(clusterEmbeddings[j]!.vector);
        totalSim += cosineSimilarity(v1, v2);
        pairCount++;
      }
    }

    const cohesion = pairCount > 0 ? totalSim / pairCount : 1.0;

    themeClusters.push({
      id: `cluster-${clusterIdx}`,
      embeddingIds: clusterEmbeddings.map((e) => e.id),
      centroid: centroids[clusterIdx]!,
      cohesion,
      size: clusterEmbeddings.length,
    });
  }

  // Sort by size (largest clusters first)
  return themeClusters.sort((a, b) => b.size - a.size);
}

/**
 * Identify recurring themes from embeddings
 * Uses clustering to find groups of similar entries
 */
export function identifyRecurringThemes(
  embeddings: AnalysisEmbedding[],
  messageIdMap: Map<string, string>, // embeddingId -> messageId/entityId
  minFrequency: number = 3,
  maxThemes: number = 10
): RecurringTheme[] {
  if (embeddings.length < minFrequency) {
    return [];
  }

  // Cluster embeddings
  const clusters = clusterEmbeddings(
    embeddings,
    Math.min(maxThemes, Math.floor(embeddings.length / minFrequency))
  );

  // Convert clusters to themes
  const themes: RecurringTheme[] = [];

  for (const cluster of clusters) {
    // Only consider clusters that meet minimum frequency
    if (cluster.size < minFrequency) {
      continue;
    }

    // Get message IDs for this cluster
    const messageIds = cluster.embeddingIds
      .map((embId) => messageIdMap.get(embId))
      .filter((id): id is string => id !== undefined);

    if (messageIds.length < minFrequency) {
      continue;
    }

    // Find representative message (most central to cluster)
    let bestEmbeddingId = cluster.embeddingIds[0]!;
    let maxAvgSim = -1;

    for (const embId of cluster.embeddingIds) {
      const emb = embeddings.find((e) => e.id === embId);
      if (!emb) continue;

      const vector = new Float32Array(emb.vector);
      let totalSim = 0;
      let count = 0;

      // Calculate average similarity to all other embeddings in cluster
      for (const otherEmbId of cluster.embeddingIds) {
        if (otherEmbId === embId) continue;

        const otherEmb = embeddings.find((e) => e.id === otherEmbId);
        if (!otherEmb) continue;

        totalSim += cosineSimilarity(vector, new Float32Array(otherEmb.vector));
        count++;
      }

      const avgSim = count > 0 ? totalSim / count : 0;
      if (avgSim > maxAvgSim) {
        maxAvgSim = avgSim;
        bestEmbeddingId = embId;
      }
    }

    const representativeMessageId = messageIdMap.get(bestEmbeddingId);
    if (!representativeMessageId) {
      continue;
    }

    themes.push({
      id: cluster.id,
      frequency: cluster.size,
      strength: cluster.cohesion,
      messageIds,
      representativeMessageId,
    });
  }

  // Sort by frequency (most common themes first)
  return themes.sort((a, b) => b.frequency - a.frequency).slice(0, maxThemes);
}

/**
 * Select random unique indices from range [0, max)
 */
function selectRandomIndices(max: number, count: number): number[] {
  const indices: number[] = [];
  const available = Array.from({ length: max }, (_, i) => i);

  for (let i = 0; i < count && available.length > 0; i++) {
    const idx = Math.floor(Math.random() * available.length);
    indices.push(available[idx]!);
    available.splice(idx, 1);
  }

  return indices;
}

/**
 * Normalize vector to unit length
 */
function normalizeVector(vector: Float32Array): Float32Array {
  let magnitude = 0;
  for (let i = 0; i < vector.length; i++) {
    magnitude += vector[i]! * vector[i]!;
  }

  magnitude = Math.sqrt(magnitude);

  if (magnitude === 0) {
    return vector;
  }

  const normalized = new Float32Array(vector.length);
  for (let i = 0; i < vector.length; i++) {
    normalized[i] = vector[i]! / magnitude;
  }

  return normalized;
}
