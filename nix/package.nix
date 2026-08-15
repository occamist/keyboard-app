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

  cargoHash = "sha256-4gzzDymBkfWqFmWuFMnjMZdYJKSgm1qk/H0fwK5+uDo=";

  pnpmDeps = fetchPnpmDeps {
    inherit (finalAttrs) pname version src;
    inherit pnpm;
    hash = "sha256-1zUsmzViGMT+tYndKiYUVlNvUrxInm+xXIctqN8012Y=";
    fetcherVersion = 4;
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
