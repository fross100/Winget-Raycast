import { List, ActionPanel, Action, showToast, Toast, getPreferenceValues, Keyboard, useNavigation } from "@raycast/api";
import { useState, useEffect, useMemo } from "react";
import { runShellCommand, debounce } from "./utils/windows-helpers";
import InstallConfirmation from "./install-confirmation";

interface Package {
  name: string;
  id: string;
  version: string;
  source: string;
}

interface PackageDetails {
  description?: string;
  homepage?: string;
  license?: string;
  author?: string;
  publisher?: string;
  [key: string]: string | undefined;
}

const parseWingetShowOutput = (output: string): { markdown: string; metadata: PackageDetails } => {
  const lines = output.split('\n');
  const details: PackageDetails = {};
  let description = '';
  let isDescriptionSection = false;

  const metadata = new Map<string, string>();

  lines.forEach(line => {
    const trimLine = line.trim();
    if (trimLine.startsWith('Description:')) {
      isDescriptionSection = true;
      description = trimLine.substring('Description:'.length).trim();
      return;
    }
    
    if (isDescriptionSection) {
        if (/^\s*[a-zA-Z\s]+:/.test(trimLine)) {
            isDescriptionSection = false;
        } else {
            description += `\n${trimLine}`;
            return;
        }
    }

    if (!isDescriptionSection) {
        const match = trimLine.match(/^([^:]+):\s*(.*)$/);
        if (match) {
            const [, key, value] = match;
            const lowerKey = key.toLowerCase().replace(/\s/g, '');
            metadata.set(lowerKey, value.trim());
        }
    }
  });

  let markdown = `## Description\n\n${description || 'No description available.'}\n\n`;

  return { markdown, metadata: Object.fromEntries(metadata) };
};


export default function SearchPackages() {
  const [searchText, setSearchText] = useState("");
  const [packages, setPackages] = useState<Package[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [packageMarkdown, setPackageMarkdown] = useState<string | null>(null);
  const [packageMetadata, setPackageMetadata] = useState<PackageDetails | null>(null);
  const { push } = useNavigation();
  
  const preferences = getPreferenceValues();
  const [showDetail, setShowDetail] = useState(preferences.showInfoPanel);

  useEffect(() => {
    async function searchWinget() {
      setIsLoading(true);
      let stdout = "";
      try {
        const searchCommand = searchText.includes(" ") ? `winget search "${searchText}"` : `winget search ${searchText}`;
        const result = await runShellCommand(searchCommand);
        stdout = result.stdout;

        const lines = stdout.split("\n").filter((line) => line.trim() !== "");

        const parsedPackages: Package[] = [];
        if (lines.length > 2) {
          for (let i = 2; i < lines.length; i++) {
            const line = lines[i];
            const parts = line.trim().split(/\s+/);

            if (parts.length < 4) {
              continue;
            }

            let name = "";
            let id = "";
            let version = "";
            let source = "";

            source = parts[parts.length - 1];
            version = parts[parts.length - 2];

            if (parts[parts.length - 3].startsWith("Tag:")) {
              id = parts[parts.length - 4];
              name = parts.slice(0, parts.length - 4).join(" ");
            } else {
              id = parts[parts.length - 3];
              name = parts.slice(0, parts.length - 3).join(" ");
            }

            parsedPackages.push({
              name: name.trim(),
              id: id.trim(),
              version: version.trim(),
              source: source.trim(),
            });
          }
        }

        setPackages(
          parsedPackages.filter((pkg) => {
            const normalizedSearchText = searchText.toLowerCase();
            const normalizedPkgName = pkg.name.toLowerCase();
            const normalizedPkgId = pkg.id.toLowerCase();

            return normalizedPkgName.includes(normalizedSearchText) || normalizedPkgId.includes(normalizedSearchText);
          })
        );
      } catch (error) {
        showToast(Toast.Style.Failure, "Error searching packages", String(error));
      } finally {
        setIsLoading(false);
      }
    }

    const handler = setTimeout(() => {
      if (searchText.length > 2) {
        searchWinget();
      } else {
        setPackages([]);
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [searchText]);

  useEffect(() => {
    async function fetchPackageDetails() {
      if (!selectedPackageId) {
        setPackageMarkdown(null);
        setPackageMetadata(null);
        return;
      }
      setIsDetailLoading(true);
      try {
        const result = await runShellCommand(`winget show --id ${selectedPackageId}`);
        const { markdown, metadata } = parseWingetShowOutput(result.stdout);
        setPackageMarkdown(markdown);
        setPackageMetadata(metadata);
      } catch (error) {
        showToast(Toast.Style.Failure, "Error fetching package details", String(error));
        setPackageMarkdown("Could not load details.");
        setPackageMetadata(null);
      } finally {
        setIsDetailLoading(false);
      }
    }
    if (showDetail) {
      fetchPackageDetails();
    }
  }, [selectedPackageId, showDetail]);

  const debouncedSetSelectedPackageId = useMemo(
    () =>
      debounce((id: string | null) => {
        if (id) {
          setSelectedPackageId(id);
        }
      }, 300),
    []
  );

  return (
    <List
      isLoading={isLoading}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search Winget packages..."
      isShowingDetail={showDetail}
      onSelectionChange={debouncedSetSelectedPackageId}
    >
      {packages.map((pkg) => (
        <List.Item
          key={pkg.id}
          id={pkg.id}
          title={pkg.name}
          subtitle={showDetail ? `ID: ${pkg.id}` : `ID: ${pkg.id} | Version: ${pkg.version} | Source: ${pkg.source}`}
          detail={
            <List.Item.Detail 
              isLoading={isDetailLoading} 
              markdown={packageMarkdown}
              metadata={
                packageMetadata && (
                  <List.Item.Detail.Metadata>
                    <List.Item.Detail.Metadata.Label title="Package Name" text={pkg.name} />
                    <List.Item.Detail.Metadata.Label title="Version" text={pkg.version} />
                    <List.Item.Detail.Metadata.Label title="Source" text={pkg.source} />
                    {Object.entries(packageMetadata).map(([key, value]) => (
                      value && <List.Item.Detail.Metadata.Label key={key} title={key.charAt(0).toUpperCase() + key.slice(1)} text={value} />
                    ))}
                  </List.Item.Detail.Metadata>
                )
              }
            />
          }
          actions={
            <ActionPanel>
              <Action title="Install Package" onAction={() => push(<InstallConfirmation pkgId={pkg.id} pkgName={pkg.name} />)} />
              <Action
                title={showDetail ? "Hide Details" : "Show Details"}
                onAction={() => setShowDetail(!showDetail)}
                shortcut={{ modifiers: ["ctrl"], key: "enter" }}
              />
              <Action.CopyToClipboard title="Copy Package ID" content={pkg.id} />
              <Action.OpenInBrowser
                title="Search on Winget.run"
                url={`https://winget.run/pkg/${pkg.id.split(".")[0]}/${pkg.id.split(".").slice(1).join(".")}`}
              />
            </ActionPanel>
          }
        />
      ))}
      {packages.length === 0 && !isLoading && searchText.length > 2 && (
        <List.EmptyView title="No packages found" description="Try a different search term." />
      )}
      {searchText.length <= 2 && (
        <List.EmptyView title="Start typing to search" description="Enter at least 3 characters to search for packages." />
      )}
    </List>
  );
}