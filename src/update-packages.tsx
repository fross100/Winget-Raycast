import { List, ActionPanel, Action, showToast, Toast, Icon, useNavigation } from "@raycast/api";
import { useState, useEffect } from "react";
import { runShellCommand } from "./utils/windows-helpers";
import UpgradeConfirmation from "./upgrade-confirmation";

interface OutdatedPackage {
  name: string;
  id: string;
  version: string;
  availableVersion: string;
  source: string;
}

export default function UpdatePackages() {
  const { push } = useNavigation();
  const [outdatedPackages, setOutdatedPackages] = useState<OutdatedPackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function fetchOutdatedPackages() {
    setIsLoading(true);
    try {
      const { stdout, stderr, code } = await runShellCommand("winget upgrade");

      if (code !== 0 && stderr.includes("No installed package found that can be upgraded")) {
        setOutdatedPackages([]);
        showToast(Toast.Style.Success, "No outdated packages found.");
        return;
      } else if (code !== 0) {
        throw new Error(stderr || "Unknown error fetching outdated packages.");
      }
      
      const lines = stdout.split("\n").map(line => line.trim()).filter(line => line !== "");

      const parsedPackages: OutdatedPackage[] = [];
      if (lines.length > 2) { // Skip header lines
        for (let i = 2; i < lines.length; i++) {
          const line = lines[i];
          const match = line.match(/^(.+?)\s+([\w\d\.\-]+)\s+([\d\.]+)\s+([\d\.]+)\s+(\S+)$/);
          if (match) {
            parsedPackages.push({
              name: match[1].trim(),
              id: match[2].trim(),
              version: match[3].trim(),
              availableVersion: match[4].trim(),
              source: match[5].trim(),
            });
          }
        }
      }
      setOutdatedPackages(parsedPackages.filter(pkg => pkg.source !== "tag:"));
    } catch (error) {
      showToast(Toast.Style.Failure, "Error fetching outdated packages", String(error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchOutdatedPackages();
  }, []);

  async function upgradePackage(packageId: string, packageName: string) {
    push(<UpgradeConfirmation pkgId={packageId} pkgName={packageName} />);
  }

  async function upgradeAllPackages() {
    push(<UpgradeConfirmation pkgId="all" pkgName="all packages" />);
  }

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Filter outdated packages...">
      {outdatedPackages.length === 0 && !isLoading ? (
        <List.EmptyView
          title="No outdated packages found"
          description="All your packages are up to date!"
          actions={
            <ActionPanel>
              <Action title="Refresh" onAction={fetchOutdatedPackages} />
            </ActionPanel>
          }
        />
      ) : (
        outdatedPackages.map((pkg) => (
          <List.Item
            key={pkg.id}
            title={pkg.name}
            subtitle={`ID: ${pkg.id} | Current: ${pkg.version} | Available: ${pkg.availableVersion} | Source: ${pkg.source}`}
            actions={
              <ActionPanel>
                <Action title="Upgrade Package" onAction={() => upgradePackage(pkg.id, pkg.name)} />
                <Action title="Upgrade All Outdated" onAction={upgradeAllPackages} />
                <Action.CopyToClipboard title="Copy Package ID" content={pkg.id} />
                {pkg.source === "msstore" && (
                  <Action.OpenInBrowser
                    title="Open in Microsoft Store"
                    url={`ms-windows-store://pdp/?ProductId=${pkg.id}`}
                  />
                )}
                <Action title="Refresh" onAction={fetchOutdatedPackages} />
              </ActionPanel>
            }
          />
        ))
      )}
      {outdatedPackages.length > 0 && (
        <List.Section title="Actions">
          <List.Item
            title="Upgrade All Outdated Packages"
            icon={Icon.Info}
            actions={
              <ActionPanel>
                <Action title="Upgrade All Outdated" onAction={upgradeAllPackages} />
              </ActionPanel>
            }
          />
        </List.Section>
      )}
    </List>
  );
}