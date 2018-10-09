const phabURL = "https://phabricator.services.mozilla.com";
const tokenPattern = /api-.*/;
const phidPattern = /PHID-USER-.*/;

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

  await createBadge(`${revs.result.length}`, accountNode, revs.result.length > 0);
}

async function createBadge(content, accountNode, warn) {
  const container = document.createElement("div");
  container.id = "phabr-badge-container";
  container.style.position = "relative";
  container.style.margin = "0px";

  const badge = document.createElement("div");
  badge.id = "phabr-badge";
  badge.style.position = "absolute";
  badge.style.top = "-12px";
  badge.style.left = "0px";
  badge.style.margin = "0px";
  badge.style.width = "24px";
  badge.style.height = "24px";
  badge.style.borderRadius = "12px";
  badge.style.textAlign = "center";
  if (warn) {
    badge.style.backgroundColor = "#BB0000";
  } else {
    badge.style.backgroundColor = "#BBBBBB";
  }
  badge.style.color = "#FFF";
  badge.style.fontSize = "20px";
  badge.style.fontWeight = "bold";
  container.appendChild(badge);

  const count = document.createElement("a");
  count.textContent = content;
  count.href = phabURL;
  badge.appendChild(count);

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
