# To learn more about how to use Nix to configure your environment
# see: https://firebase.google.com/docs/studio/customize-workspace
{
  pkgs
}: {
  # -- Nixpkgs Channel Configuration --
  # Specifies which nixpkgs channel to use for fetching packages.
  # 'stable-24.11' indicates a specific stable release channel for Nix packages.
  # You can also use "unstable" for the latest, but potentially less stable, versions.
  channel = "stable-24.11"; # or "unstable"

  # -- System Packages Configuration --
  # Use https://search.nixos.org/packages to find packages
  # Defines the list of system packages to be made available in the development environment.
  packages = [
    pkgs.nodejs_20 # Node.js runtime environment version 20, essential for JavaScript projects.
  ];

  # -- Environment Variables --
  # Sets environment variables that will be available within the workspace.
  # This block is currently empty but can be extended to define custom environment variables
  # needed for your application or development setup.
  env = {};

  # -- IDX (Integrated Development Experience) Configuration --
  # This block contains settings specific to the IDX development environment, such as VS Code extensions and workspace behavior.
  idx = {
    # -- VS Code Extensions --
    # Search for the extensions you want on https://open-vsx.org/ and use "publisher.id"
    # Lists VS Code extensions to be automatically installed and enabled in the workspace.
    extensions = [
      # Example: "vscodevim.vim" - Uncomment to install the Vim extension.
    ];
    # -- Workspace-specific Settings --
    workspace = {
      # Actions to perform when the workspace is initially created (first launch).
      onCreate = {
        # Lists files to automatically open in the editor when the workspace starts.
        default.openFiles = [
          "src/app/page.tsx"
        ];
      };
    };
    # -- Previews Configuration --
    # Enables and customizes the behavior of web application previews within the IDX environment.
    previews = {
      enable = true;
      previews = {
        # Configuration for the primary web preview.
        web = {
          # Command to run the Next.js development server.
          # It binds to the provided PORT environment variable and listens on all network interfaces (0.0.0.0)
          # to allow external access (e.g., from the browser preview).
          command = ["npm" "run" "dev" "--" "--port" "$PORT" "--hostname" "0.0.0.0"];
          # Specifies the preview manager, often 'web' for standard web applications.
          manager = "web";
        };
      };
    };
  };
}
