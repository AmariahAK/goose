#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "usage: $0 <native-lib> [jna-resource-prefix]" >&2
  exit 1
fi

native_lib="$1"
resource_prefix="${2:-$(crates/goose-sdk/scripts/maven-resource-prefix.sh)}"

case "$resource_prefix" in
  darwin-aarch64|darwin-x86-64|linux-x86-64|win32-x86-64) ;;
  *) echo "unsupported JNA resource prefix: $resource_prefix" >&2; exit 1 ;;
esac

if [ ! -f "$native_lib" ]; then
  echo "native library not found: $native_lib" >&2
  exit 1
fi

bindgen="target/release/goose-uniffi-bindgen"
if [ ! -x "$bindgen" ]; then
  cargo build -p goose-sdk --features uniffi --release -q
fi

maven_dir="crates/goose-sdk/maven"
kotlin_dir="$maven_dir/src/main/kotlin"
resources_dir="$maven_dir/src/main/resources"

rm -rf "$kotlin_dir/io/aaif/goose" "$resources_dir/$resource_prefix"
mkdir -p "$kotlin_dir" "$resources_dir/$resource_prefix" "$maven_dir/src/main/resources/META-INF"
cp LICENSE "$maven_dir/src/main/resources/META-INF/LICENSE"

"$bindgen" generate \
  --library "$native_lib" \
  --config crates/goose-sdk/uniffi.toml \
  --language kotlin \
  --no-format \
  --out-dir "$kotlin_dir" 2>/dev/null

cat > "$kotlin_dir/io/aaif/goose/NativeLibraryLoader.kt" <<'KOTLIN'
package io.aaif.goose

import com.sun.jna.Native
import java.nio.file.Files

internal object NativeLibraryLoader {
    init {
        val componentName = "goose"
        if (System.getProperty("uniffi.component.$componentName.libraryOverride") == null) {
            val resource = nativeResourcePath()
            val stream = NativeLibraryLoader::class.java.classLoader.getResourceAsStream(resource)
                ?: error("Goose SDK native library resource not found: $resource")
            val library = Files.createTempFile("goose-sdk-", nativeLibraryFileName()).toFile()
            library.deleteOnExit()
            stream.use { input -> library.outputStream().use { output -> input.copyTo(output) } }
            System.setProperty("uniffi.component.$componentName.libraryOverride", library.absolutePath)
        }
    }

    fun ensureLoaded() = Unit

    private fun nativeResourcePath(): String = "${jnaResourcePrefix()}/${nativeLibraryFileName()}"

    private fun nativeLibraryFileName(): String = when (osName()) {
        "darwin" -> "libgoose_sdk.dylib"
        "linux" -> "libgoose_sdk.so"
        "win32" -> "goose_sdk.dll"
        else -> error("Unsupported OS: ${System.getProperty("os.name")}")
    }

    private fun jnaResourcePrefix(): String = "${osName()}-${archName()}"

    private fun osName(): String = when {
        System.getProperty("os.name").startsWith("Mac OS X") -> "darwin"
        System.getProperty("os.name").startsWith("Linux") -> "linux"
        System.getProperty("os.name").startsWith("Windows") -> "win32"
        else -> System.getProperty("os.name").lowercase().replace(Regex("\\s+"), "-")
    }

    private fun archName(): String = when (val arch = Native.ARCH) {
        "aarch64" -> "aarch64"
        "x86-64" -> "x86-64"
        else -> arch
    }
}
KOTLIN

python3 - "$kotlin_dir/io/aaif/goose/goose.kt" <<'PY'
import sys
from pathlib import Path
path = Path(sys.argv[1])
text = path.read_text()
needle = 'private fun findLibraryName(componentName: String): String {\n'
replacement = needle + '    NativeLibraryLoader.ensureLoaded()\n'
if needle not in text:
    raise SystemExit('could not find findLibraryName in generated Kotlin bindings')
path.write_text(text.replace(needle, replacement, 1))
PY

cp "$native_lib" "$resources_dir/$resource_prefix/"
