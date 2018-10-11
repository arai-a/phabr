const phabURL = "https://phabricator.services.mozilla.com";
const bmoURL = "https://bugzilla.mozilla.org/";

function bugURL(bugnumber) {
  return `${bmoURL}show_bug.cgi?id=${bugnumber}`;
}

let called = false;
async function addButton(accountNode, revs) {
  if (called) {
    // There can be some case that the message is received twice or more.
    // Ignore subsequent ones.
    return;
  }
  called = true;

  const outerContainer = document.createElement("div");
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
  if (revs.length > 0) {
    badge.className = "warn";
  }
  if (revs.length < 10) {
    badge.textContent = `${revs.length}`;
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

  if (revs.length === 0) {
    const empty = document.createElement("empty");
    empty.className = "empty";
    empty.textContent = "You’re all caught up!";
    menu.appendChild(empty);
  } else {
    const list = document.createElement("ul");
    list.className = "notifications";
    list.setAttribute("role", "none");

    for (const rev of revs) {
      const item = document.createElement("li");
      item.setAttribute("role", "none");

      const link = document.createElement("a");
      link.setAttribute("role", "menuitem");
      link.setAttribute("tabindex", "-1");
      link.href = rev.uri;

      const label = document.createElement("label");

      const author = document.createElement("strong");
      author.textContent = rev.author;
      label.appendChild(author);

      label.appendChild(document.createTextNode(" asked for your review for "));

      const title = document.createElement("strong");
      title.textContent = rev.title;
      label.appendChild(title);

      if (rev.bugnumber) {
        label.appendChild(document.createTextNode(" ("));

        const buglink = document.createElement("strong");
        buglink.href = bugURL(rev.bugnumber);
        buglink.textContent = `Bug ${rev.bugnumber}`;
        label.appendChild(buglink);

        label.appendChild(document.createTextNode(")"));
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

function onLoad() {
  const accountNode = document.getElementById("header-account");
  if (!accountNode) {
    return;
  }

  const outerContainer = document.getElementById("phabr-outer-container");
  if (outerContainer) {
    // Remove container from previous version.
    outerContainer.remove();
  }

  browser.runtime.onMessage.addListener(message => {
    switch (message.topic) {
      case "revs": {
        addButton(accountNode, message.revs);
        break;
      }
    }
  });

  // Because the error thrown by browser.runtime.sendMessage is not catchable,
  // use interval timer to retry until it succeeds.

  let timer;
  let remaining = 5;
  function tryQuery() {
    remaining--;
    if (remaining === 0) {
      // If browser.runtime.sendMessage fails many time, finish.
      clearInterval(timer);
    }

    browser.runtime.sendMessage({ topic: "query" });
    // If browser.runtime.sendMessage doesn't throw, finish.
    clearInterval(timer);
  }
  timer = setInterval(tryQuery, 2000);
  setTimeout(tryQuery, 0);
}
onLoad();
