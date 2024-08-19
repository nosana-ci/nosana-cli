export function repoTagsContainsImage(
  image: string,
  repoTags: string[] | undefined,
): boolean {
  if (!repoTags) return false;

  const imageWithTag = `${image}${!image.includes(':') ? ':latest' : ''}`;

  const possible_options = [
    imageWithTag,
    `docker.io/${imageWithTag}`,
    `docker.io/library/${imageWithTag}`,
    `registry.hub.docker.com//${imageWithTag}`,
    `registry.hub.docker.com/library/${imageWithTag}`,
  ];

  return repoTags.some((tag) => possible_options.includes(tag));
}
