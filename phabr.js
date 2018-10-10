const phabURL = "https://phabricator.services.mozilla.com";
const bmoURL = "https://bugzilla.mozilla.org/";
const tokenPattern = /api-.*/;
const phidPattern = /PHID-USER-.*/;

function bugURL(bugnumber) {
  return `${bmoURL}show_bug.cgi?id=${bugnumber}`;
}

async function ConduitAPI(name, params=[]) {
  const query = params
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join("&");
  const uri = `${phabURL}/api/${name}?${query}`;
  const response = await fetch(uri);
  return response.json();
}

async function loadToken() {
  try {
    const { token } = await browser.storage.local.get("token");
    if (tokenPattern.test(token)) {
      return token;
    }
  } catch (e) {
  }
  return "";
}

async function savePhid(phid) {
  try {
    await browser.storage.local.set({
      "phid": phid
    });
  } catch (e) {
  }
}

async function loadOrGetPhid(token) {
  try {
    const { phid } = await browser.storage.local.get("phid");
    if (phidPattern.test(phid)) {
      return phid;
    }
  } catch (e) {
  }

  const whoami = await ConduitAPI("user.whoami", [
    ["api.token", token],
  ]);
  const phid = whoami.result.phid;
  if (phidPattern.test(phid)) {
    savePhid(phid);
    return phid;
  }

  return "";
}

async function getPendingReviews(token, phid) {
  return ConduitAPI("differential.query", [
    ["api.token", token],
    ["reviewers[0]", phid],
    ["status", "status-needs-review"],
    ["order", "order-modified"],
    ["limit", "10"],
  ]);
}

async function addBadge(token, phid, accountNode) {
  const revs = await getPendingReviews(token, phid);

  const container = document.createElement("div");
  container.id = "phabr-badge-container";

  const badge = document.createElement("div");
  badge.id = "phabr-badge";
  if (revs.result.length > 0) {
    badge.className = "warn";
  }
  if (revs.result.length < 10) {
    badge.textContent = `${revs.result.length}`;
  } else {
    badge.textContent = `*`;
  }
  container.appendChild(badge);

  badge.addEventListener("click", () => {
    let menu = document.getElementById("phabr-menu");
    if (menu) {
      menu.remove();
      return;
    }

    if (revs.result.length == 0) {
      return;
    }

    menu = document.createElement("div");
    menu.id = "phabr-menu";

    for (const rev of revs.result) {
      const item = document.createElement("div");
      item.className = "phabr-menu-item";

      if (rev.auxiliary && rev.auxiliary["bugzilla.bug-id"]) {
        const bugnumber = rev.auxiliary["bugzilla.bug-id"];
        const link = document.createElement("a");
        link.className = "phabr-menu-bugnumber";
        link.href = bugURL(bugnumber);
        link.textContent = `Bug ${bugnumber}`;
        item.appendChild(link);

        item.appendChild(document.createElement("br"));
      }
      const title = document.createElement("a");
      title.className = "phabr-menu-revtitle";
      title.href = rev.uri;
      title.textContent = rev.title;
      item.appendChild(title);

      item.appendChild(document.createElement("br"));

      const date = document.createElement("div");
      date.className = "phabr-menu-date";
      date.textContent = new Intl.DateTimeFormat('ja', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(new Date(rev.dateModified * 1000));
      item.appendChild(date);

      menu.appendChild(item);
    }

    container.appendChild(menu);
  });

  accountNode.parentNode.insertBefore(container, accountNode.nextSibling);
}

async function onLoad() {
  const accountNode = document.getElementById("header-account");
  if (!accountNode) {
    return;
  }

  const token = await loadToken();
  if (!token) {
    return;
  }
  const phid = await loadOrGetPhid(token);
  if (!phid) {
    return;
  }
  addBadge(token, phid, accountNode);
}
onLoad().catch(console.log);
