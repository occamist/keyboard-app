{
  lib,
  stdenv,
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
  openssl,
  webkitgtk_4_1,
  writeShellApplication,
  nix,
  gnused,
  gnugrep,
}:

let
  pnpm = pnpm_10;
in
rustPlatform.buildRustPackage (finalAttrs: {
  pname = "keyboard-app";
  version = (builtins.fromTOML (builtins.readFile ../src-tauri/Cargo.toml)).package.version;

  src = lib.cleanSource ../.;

  cargoRoot = "src-tauri";
  buildAndTestSubdir = "src-tauri";

  # Vendors straight from Cargo.lock's own per-crate checksums, so this
  # never needs a manual hash bump when Rust dependencies change.
  cargoLock.lockFile = ../src-tauri/Cargo.lock;

  pnpmDeps = fetchPnpmDeps {
    inherit (finalAttrs) pname version src;
    inherit pnpm;
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
      gnused
      gnugrep
    ];
    text = ''
      repo_root="$(git rev-parse --show-toplevel)"
      package_nix="$repo_root/nix/package.nix"
      fake_hash="sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="

      current_hash=$(sed -n 's/.*hash = "\(sha256-[^"]*\)";.*/\1/p' "$package_nix")
      if [[ -z "$current_hash" ]]; then
        echo "error: could not find pnpmDeps hash in $package_nix" >&2
        exit 1
      fi

      # Anchored to the `hash = "...";` attribute context, not a bare literal-string
      # substitution: this script's own source (embedded in the file it edits) also
      # contains the fake_hash value as `fake_hash="..."`, which an unanchored sed
      # would also match and corrupt.
      sed -i "s|hash = \"$current_hash\";|hash = \"$fake_hash\";|" "$package_nix"

      echo "Building with a fake hash to learn the real one..." >&2
      build_output=$(cd "$repo_root" && nix build .#default -L 2>&1) && {
        echo "error: build succeeded with a fake hash, which should be impossible" >&2
        exit 1
      } || true

      real_hash=$(grep -oP 'got:\s+\K\S+' <<<"$build_output" | head -1)
      if [[ -z "$real_hash" ]]; then
        sed -i "s|hash = \"$fake_hash\";|hash = \"$current_hash\";|" "$package_nix"
        echo "error: could not determine the real hash; build output:" >&2
        echo "$build_output" >&2
        exit 1
      fi

      sed -i "s|hash = \"$fake_hash\";|hash = \"$real_hash\";|" "$package_nix"
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
  ]
  ++ lib.optionals stdenv.hostPlatform.isLinux [
    wrapGAppsHook4
  ];

  buildInputs = [
    openssl
  ]
  ++ lib.optionals stdenv.hostPlatform.isLinux [
    glib-networking
    libayatana-appindicator
    libappindicator-gtk3
    webkitgtk_4_1
  ];

  # libappindicator-sys dlopens its library at runtime by bare soname, trying
  # libayatana-appindicator3.so.1 first and falling back to libappindicator3.so.1.
  # Neither name resolves in the Nix sandbox without an absolute path, so patch
  # both attempts to point at their store paths directly.
  postPatch = lib.optionalString stdenv.hostPlatform.isLinux ''
    for libappindicatorRs in $cargoDepsCopy/*/libappindicator-sys-*/src/lib.rs; do
      if [[ -f "$libappindicatorRs" ]]; then
        substituteInPlace "$libappindicatorRs" \
          --replace-fail "libayatana-appindicator3.so.1" "${libayatana-appindicator}/lib/libayatana-appindicator3.so.1" \
          --replace-fail "libappindicator3.so.1" "${libappindicator-gtk3}/lib/libappindicator3.so.1"
      fi
    done
  '';

  preBuild = ''
    pnpm build
  '';

  doCheck = false;

  meta = {
    description = "Cross-platform on-screen keyboard for different languages";
    homepage = "https://github.com/occamist/keyboard-app";
    changelog = "https://github.com/occamist/keyboard-app/releases/tag/v${finalAttrs.version}";
    license = lib.licenses.mit;
    mainProgram = "keyboard-app";
    platforms = lib.platforms.linux;
  };
})
