# DonutSMP outage monitor

Checks DonutSMP status every five minutes using GitHub Actions. It sends you a Discord DM when a monitored region or anti-cheat status changes to down or recovers.

## One-time setup

1. Add the Discord bot to your server and make sure it is online/available to DM your account.
2. In this repository, open **Settings → Secrets and variables → Actions**.
3. Add repository secrets named `DISCORD_BOT_TOKEN` and `DISCORD_USER_ID`. Use the bot token from your local bot setup and your Discord user ID. Never put the token in a source file or commit it.
4. Open **Actions → DonutSMP outage monitor → Run workflow** for the first check. Scheduled checks then run every five minutes.

The monitor stores only outage state in `.github/monitor-state.json`. GitHub Actions commits state changes to the public repository. The source code and state file are public; keep credentials only in GitHub Secrets.
