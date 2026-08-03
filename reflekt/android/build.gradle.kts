allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
// Some plugins still declare an old compileSdk — onnxruntime pins 33, while its
// own transitive dependencies now require 34 or later, so the build fails on a
// conflict inside a dependency rather than anything in this app. Raising the
// floor for library subprojects fixes it without forking the plugin.
//
// Only the compile-time SDK is affected. minSdk, and therefore which devices
// can install the app, is untouched.
//
// This must come before `evaluationDependsOn(":app")` below: that forces every
// subproject to evaluate, and `afterEvaluate` cannot be registered on a project
// that has already been evaluated.
subprojects {
    afterEvaluate {
        extensions.findByType<com.android.build.gradle.LibraryExtension>()?.apply {
            if (compileSdk != null && compileSdk!! < 34) {
                compileSdk = 36
            }
        }
    }
}

subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
