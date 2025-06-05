export function checkDeprecationDeadline() {
  // 5pm CET today before the error starts showing
  // Check if current time is after the deadline
  const warning = new Date('2025-06-05T16:00:00+02:00'); // 05-06-2025 16:00 CET
  const deadline = new Date('2025-06-06T15:00:00+02:00'); // 06-06-2025 15:00 CET
  const now = new Date();

  if (now > deadline) {
    throw new Error(
      'HTTP connections are no longer supported. Please use socket connection instead. Restart your host with `bash <(wget -qO- https://nosana.com/start.sh)`',
    );
  }

  if (now > warning) {
    const brightRed = '\x1b[91m'; // Bright red text
    const reset = '\x1b[0m'; // Reset to default color

    console.error(
      ` ${brightRed}WARNING: Using podman over HTTP is deprecated, use socket instead${reset}`,
    );
    console.error(
      `${brightRed}Restart your host with \`bash <(wget -qO- https://nosana.com/start.sh)\` before 06-06-2025 15:00 CET${reset}`,
    );
  }
}
