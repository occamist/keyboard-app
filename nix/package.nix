{
  lib,
  rustPlatform,
  cargo-tauri,
  nodejs_24,
  pnpm_10,
  pnpmConfigHook,
  fetchPnpmDeps,
  pkg-config,
  wrapGAppsHook4,
  glib-networking,
  libayatana-appindicator,
  libappindicator-gtk3,
  webkitgtk_4_1,
  writeShellApplication,
  nix,
  git,
  gnused,
  gnugrep,
}:

let
  pnpm = pnpm_10;
in
rustPlatform.buildRustPackage (finalAttrs: {
  pname = "keyboard-app";
  version = (builtins.fromTOML (builtins.readFile ../src-tauri/Cargo.toml)).package.version;

  # Everything except files that cannot affect the build. Excluding rather than
  # listing what to keep, so a new frontend config file is not silently dropped
  # from the build; the point is only to stop docs and packaging churn from
  # invalidating src and forcing a full Rust + frontend rebuild.
  src = lib.fileset.toSource {
    root = ../.;
    fileset = lib.fileset.difference ../. (
      lib.fileset.unions [
        ../README.md
        ../logo.png
        ../screenshot.png
        ../install.sh
        ../.github
        ../nix
        ../flake.nix
        ../flake.lock
      ]
    );
  };

  cargoRoot = "src-tauri";
  buildAndTestSubdir = "src-tauri";

  # Vendors straight from Cargo.lock's own per-crate checksums, so this
  # never needs a manual hash bump when Rust dependencies change.
  cargoLock.lockFile = ../src-tauri/Cargo.lock;

  pnpmDeps = fetchPnpmDeps {
    inherit (finalAttrs) pname version;
    inherit pnpm;

    # Deliberately not finalAttrs.src: `pnpm install --frozen-lockfile` only reads
    # these three files, so feeding it the whole tree would re-run the dependency
    # fetch on every unrelated commit (a README edit, a new screenshot). The
    # resolved output -- and therefore the hash below -- is identical either way.
    src = lib.fileset.toSource {
      root = ../.;
      fileset = lib.fileset.unions [
        ../package.json
        ../pnpm-lock.yaml
        ../pnpm-workspace.yaml
      ];
    };

    hash = "sha256-1zUsmzViGMT+tYndKiYUVlNvUrxInm+xXIctqN8012Y=";
    fetcherVersion = 4;
  };

  # Rust deps vendor from Cargo.lock directly (see cargoLock above) and never
  # need a hash bump. pnpmDeps.hash above does, whenever pnpm-lock.yaml
  # changes: run this to rewrite it in place.
  #   nix run .#default.passthru.updateHashesScript
  passthru.updateHashesScript = writeShellApplication {
    name = "keyboard-app-update-hashes";
    runtimeInputs = [
      nix
      git
      gnused
      gnugrep
    ];
    text = ''
      repo_root="$(git rev-parse --show-toplevel)"
      package_nix="$repo_root/nix/package.nix"
      fake_hash="sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="

      # Find the hash attribute by line number and insist there is exactly one.
      # The old approach substituted on the literal hash string anywhere in the
      # file, which silently degrades the moment a second `hash = "sha256-...";`
      # appears: sed -n prints every match, $current_hash becomes multi-line, and
      # the substitutions below turn into malformed sed programs. Failing here
      # with a clear message beats corrupting the file the script is editing.
      #
      # The `^[[:space:]]*hash = ` anchor is also what keeps this script from
      # matching its own source, which lives in the file it rewrites: the
      # fake_hash assignment above is `fake_hash="..."`, not `hash = "..."`.
      mapfile -t hash_lines < <(grep -nE '^[[:space:]]*hash = "sha256-[^"]*";' "$package_nix")
      if (( ''${#hash_lines[@]} != 1 )); then
        echo "error: expected exactly one 'hash = \"sha256-...\";' in $package_nix, found ''${#hash_lines[@]}" >&2
        if (( ''${#hash_lines[@]} > 0 )); then
          printf '  %s\n' "''${hash_lines[@]}" >&2
        fi
        exit 1
      fi

      hash_lineno=''${hash_lines[0]%%:*}
      current_hash=$(sed -n "''${hash_lineno}s/.*\"\(sha256-[^\"]*\)\".*/\1/p" "$package_nix")

      # Every rewrite below is scoped to that one line number, so no other
      # occurrence of the hash text anywhere in the file can be touched.
      sed -i "''${hash_lineno}s|\"$current_hash\"|\"$fake_hash\"|" "$package_nix"

      echo "Building with a fake hash to learn the real one..." >&2
      build_output=$(cd "$repo_root" && nix build .#default -L 2>&1) && {
        echo "error: build succeeded with a fake hash, which should be impossible" >&2
        exit 1
      } || true

      real_hash=$(grep -oP 'got:\s+\K\S+' <<<"$build_output" | head -1)
      if [[ -z "$real_hash" ]]; then
        sed -i "''${hash_lineno}s|\"$fake_hash\"|\"$current_hash\"|" "$package_nix"
        echo "error: could not determine the real hash; build output:" >&2
        echo "$build_output" >&2
        exit 1
      fi

      sed -i "''${hash_lineno}s|\"$fake_hash\"|\"$real_hash\"|" "$package_nix"
      echo "Updated pnpmDeps hash to $real_hash" >&2

      echo "Verifying build..." >&2
      (cd "$repo_root" && nix build .#default -L)
      echo "OK" >&2
    '';
  };

  nativeBuildInputs = [
    cargo-tauri.hook
    nodejs_24
    pnpm
    pnpmConfigHook
    pkg-config
    wrapGAppsHook4
  ];

  buildInputs = [
    glib-networking
    libayatana-appindicator
    libappindicator-gtk3
    webkitgtk_4_1
  ];

  # libappindicator-sys dlopens its library at runtime by bare soname, trying
  # libayatana-appindicator3.so.1 first and falling back to libappindicator3.so.1.
  # Neither name resolves in the Nix sandbox without an absolute path, so patch
  # both attempts to point at their store paths directly.
  postPatch = ''
    # importCargoLock (cargoLock above) vendors crates flat at the top level;
    # fetchCargoVendor nests them one deeper. Match both so switching backends
    # cannot silently stop patching.
    patched=0
    for libappindicatorRs in \
      $cargoDepsCopy/libappindicator-sys-*/src/lib.rs \
      $cargoDepsCopy/*/libappindicator-sys-*/src/lib.rs; do
      [[ -f "$libappindicatorRs" ]] || continue
      substituteInPlace "$libappindicatorRs" \
        --replace-fail "libayatana-appindicator3.so.1" "${libayatana-appindicator}/lib/libayatana-appindicator3.so.1" \
        --replace-fail "libappindicator3.so.1" "${libappindicator-gtk3}/lib/libappindicator3.so.1"
      patched=$((patched + 1))
    done

    # Fail loudly rather than shipping a binary whose tray icon dies at runtime:
    # a silent no-op here builds and installs fine, and only breaks on launch.
    if (( patched == 0 )); then
      echo "postPatch: found no libappindicator-sys sources under \$cargoDepsCopy;" >&2
      echo "the dlopen paths would stay unpatched and the tray icon would fail at runtime." >&2
      exit 1
    fi
  '';

  # The frontend is built by tauri.conf.json's beforeBuildCommand ("pnpm build"),
  # which cargo-tauri.hook triggers during the build phase. Doing it here too
  # would just build it twice.

  # cargo-tauri.hook replaces the build phase (it sets dontCargoBuild) but leaves
  # rustPlatform's cargoCheckHook in place, so enabling the check phase would not
  # reuse anything from the tauri build -- `cargo test` would compile the whole
  # Rust tree a second time just to link a test binary. src-tauri currently has no
  # #[test]s for it to run, and the real suite is vitest on the frontend, which
  # cargo never sees. Flip this to true once src-tauri grows tests of its own;
  # gating on vitest instead belongs in a separate flake check.
  doCheck = false;

  meta = {
    description = "Cross-platform on-screen keyboard for different languages";
    homepage = "https://github.com/occamist/keyboard-app";
    changelog = "https://github.com/occamist/keyboard-app/releases/tag/v${finalAttrs.version}";
    license = lib.licenses.mit;
    mainProgram = "keyboard-app";
    maintainers = [
      {
        name = "Talha Altınel";
        email = "talhaaltinel@gmail.com";
        github = "occamist";
        githubId = 22800416;
      }
    ];
    platforms = lib.platforms.linux;
  };
})
