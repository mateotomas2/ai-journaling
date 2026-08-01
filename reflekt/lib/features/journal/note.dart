/// A single piece of writing the user captured on a given day.
///
/// Mirrors a subset of the PWA's `Note` entity (`src/types/entities.ts`).
/// Fields the PWA has but this shell does not need yet — `category`, `title`,
/// `updatedAt`, `deletedAt` — arrive with persistence (ADR-0002).
class Note {
  const Note({
    required this.id,
    required this.dayId,
    required this.content,
    required this.createdAt,
  });

  final String id;
  final String dayId;
  final String content;
  final DateTime createdAt;
}
