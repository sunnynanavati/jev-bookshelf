import type { DemoSearch } from "@/lib/types";

export const demoSearches: DemoSearch[] = [
  {
    id: "snape",
    query: "Harry Potter books featuring Severus Snape",
    aliases: ["harry potter", "severus", "snape", "harry potter books which have severus"],
    resultIds: ["philosophers-stone", "chamber-secrets", "prisoner-azkaban", "goblet-fire", "half-blood-prince"],
  },
  {
    id: "surveillance",
    query: "Dystopian books about surveillance and authoritarian control",
    aliases: ["dystopian", "surveillance", "authoritarian", "government control"],
    resultIds: ["nineteen-eighty-four", "brave-new-world", "fahrenheit-451", "handmaids-tale", "never-let-me-go"],
  },
  {
    id: "unreliable",
    query: "Psychological novels with unreliable narrators",
    aliases: ["psychological", "unreliable narrator", "unreliable narrators", "dark psychological"],
    resultIds: ["gone-girl", "rebecca", "secret-history", "talented-mr-ripley", "castle"],
  },
];
