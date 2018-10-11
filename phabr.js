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

async function addButton(token, phid, accountNode) {
  const revs = await getPendingReviews(token, phid);

  let outerContainer = document.getElementById("phabr-outer-container");
  if (outerContainer) {
    // Remove container from previous version.
    outerContainer.remove();
  }

  outerContainer = document.createElement("div");
  outerContainer.id = "phabr-outer-container";

  const innerContainer = document.createElement("div");
  innerContainer.id = "phabr-inner-container";

  const button = document.createElement("button");
  button.id = "phabr-button";
  button.className = "dropdown-button minor";
  button.setAttribute("type", "button");
  button.setAttribute("title", "Phabricator Requests for you");
  button.setAttribute("aria-title", "Phabricator Requests for you");
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-haspopup", "true");
  button.setAttribute("aria-controls", "phabr-menu");

  const badge = document.createElement("span");
  badge.id = "phabr-badge";
  if (revs.result.length > 0) {
    badge.className = "warn";
  }
  if (revs.result.length < 10) {
    badge.textContent = `${revs.result.length}`;
  } else {
    badge.textContent = `*`;
  }

  button.appendChild(badge);

  innerContainer.appendChild(button);

  const menu = document.createElement("section");
  menu.id = "phabr-menu";
  menu.className = "dropdown-content dropdown-panel left";
  menu.setAttribute("role", "menu");
  menu.style.display = "none";

  const header = document.createElement("header");
  const h2 = document.createElement("h2");
  h2.textContent = "Phabricator Requests";
  header.appendChild(h2);
  menu.appendChild(header);

  if (revs.result.length === 0) {
    const empty = document.createElement("empty");
    empty.className = "empty";
    empty.textContent = "You’re all caught up!";
    menu.appendChild(empty);
  } else {
    const list = document.createElement("ul");
    list.className = "notifications";
    list.setAttribute("role", "none");

    for (const rev of revs.result) {
      const item = document.createElement("li");
      item.setAttribute("role", "none");

      const link = document.createElement("a");
      link.setAttribute("role", "menuitem");
      link.setAttribute("tabindex", "-1");
      link.href = rev.uri;

      const label = document.createElement("label");

      const title = document.createElement("strong");
      title.textContent = rev.title;
      label.appendChild(title);

      if (rev.auxiliary && rev.auxiliary["bugzilla.bug-id"]) {
        const bugnumber = rev.auxiliary["bugzilla.bug-id"];

        label.appendChild(document.createTextNode(" for "));

        const buglink = document.createElement("strong");
        buglink.href = bugURL(bugnumber);
        buglink.textContent = `Bug ${bugnumber}`;
        label.appendChild(buglink);
      }

      link.appendChild(label);

      const date = document.createElement("time");
      const d = new Date(rev.dateModified * 1000);
      date.setAttribute("datetime", d.toISOString());
      date.textContent = new Intl.DateTimeFormat('ja', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(d);
      link.appendChild(date);

      item.appendChild(link);

      list.appendChild(item);
    }

    menu.appendChild(list);
  }

  const footer = document.createElement("footer");
  const footerContent = document.createElement("div");
  const alllink = document.createElement("a");
  alllink.href = `${phabURL}/differential/`;
  alllink.setAttribute("role", "menuitem");
  alllink.setAttribute("tabindex", "-1");
  alllink.textContent = "See All";
  footerContent.appendChild(alllink);
  footer.appendChild(footerContent);
  menu.appendChild(footer);

  innerContainer.appendChild(menu);

  outerContainer.appendChild(innerContainer);

  button.addEventListener("click", event => {
    if (event.button != 0) {
      return;
    }

    if (button.getAttribute("aria-expanded") === "false") {
      button.setAttribute("aria-expanded", "true");
      menu.style.display = "";
    } else {
      button.setAttribute("aria-expanded", "false");
      menu.style.display = "none";
    }
  });

  accountNode.parentNode.insertBefore(outerContainer, accountNode.nextSibling);
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
  addButton(token, phid, accountNode);
}
onLoad().catch(console.log);
