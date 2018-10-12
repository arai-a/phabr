const phabURL = "https://phabricator.services.mozilla.com";
const bmoURL = "https://bugzilla.mozilla.org/";

function bugURL(bugnumber) {
  return `${bmoURL}show_bug.cgi?id=${bugnumber}`;
}

async function onResponse(accountNode, message) {
  const innerContainer = document.getElementById("phabr-inner-container");

  const revs = message.revs;

  const badge = document.getElementById("phabr-badge");
  if (revs) {
    if (revs.length > 0) {
      badge.className = "warn";
    }
    if (revs.length < 10) {
      badge.textContent = `${revs.length}`;
    } else {
      badge.textContent = `*`;
    }
  } else {
    badge.className = "error";
    badge.textContent = `-`;
  }

  const menu = document.createElement("section");
  menu.id = "phabr-menu";
  menu.className = "dropdown-content dropdown-panel left";
  menu.setAttribute("role", "menu");
  menu.style.display = "none";
  innerContainer.appendChild(menu);

  const header = document.createElement("header");
  menu.appendChild(header);

  const h2 = document.createElement("h2");
  h2.textContent = "Phabricator Requests";
  header.appendChild(h2);

  if (revs) {
    if (revs.length === 0) {
      const empty = document.createElement("empty");
      empty.className = "empty";
      empty.textContent = "You’re all caught up!";
      menu.appendChild(empty);
    } else {
      const list = document.createElement("ul");
      list.className = "notifications";
      list.setAttribute("role", "none");
      menu.appendChild(list);

      for (const rev of revs) {
        const item = document.createElement("li");
        item.setAttribute("role", "none");
        list.appendChild(item);

        const link = document.createElement("a");
        link.setAttribute("role", "menuitem");
        link.setAttribute("tabindex", "-1");
        link.href = rev.uri;
        item.appendChild(link);

        const label = document.createElement("label");
        link.appendChild(label);

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
      }
    }
  } else {
    const empty = document.createElement("empty");
    empty.className = "empty";
    switch (message.status) {
      case "token-na": {
        empty.textContent = "Conduit API Token is not available. Please configure in extension preference page.";
        break;
      }
      case "phid-na": {
        empty.textContent = "Phabricator PHID for token is not available. Please check Conduit API Token in extension preference page.";
        break;
      }
      case "api-error": {
        empty.textContent = `Conduit API Error for ${message.name}: error_code=${message.code}, error_info=${message.info}.`;
        break;
      }
      case "error": {
        empty.textContent = `Unknown error: ${message.message}`;
        break;
      }
    }
    menu.appendChild(empty);
  }

  const footer = document.createElement("footer");
  menu.appendChild(footer);

  const footerContent = document.createElement("div");
  footer.appendChild(footerContent);

  const allLink = document.createElement("a");
  allLink.href = `${phabURL}/differential/`;
  allLink.setAttribute("role", "menuitem");
  allLink.setAttribute("tabindex", "-1");
  allLink.textContent = "See All";
  footerContent.appendChild(allLink);

  const button = document.getElementById("phabr-button");
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
}

function addButton(accountNode) {
  const prevOuterContainer = document.getElementById("phabr-outer-container");
  if (prevOuterContainer) {
    // Remove container from previous version.
    prevOuterContainer.remove();
  }

  const outerContainer = document.createElement("div");
  outerContainer.id = "phabr-outer-container";

  const innerContainer = document.createElement("div");
  innerContainer.id = "phabr-inner-container";
  outerContainer.appendChild(innerContainer);

  const button = document.createElement("button");
  button.id = "phabr-button";
  button.className = "dropdown-button minor";
  button.setAttribute("type", "button");
  button.setAttribute("title", "Phabricator Requests for you");
  button.setAttribute("aria-title", "Phabricator Requests for you");
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-haspopup", "true");
  button.setAttribute("aria-controls", "phabr-menu");
  innerContainer.appendChild(button);

  const badge = document.createElement("span");
  badge.id = "phabr-badge";
  badge.textContent = "?";
  button.appendChild(badge);

  accountNode.parentNode.insertBefore(outerContainer, accountNode.nextSibling);
}

function onLoad() {
  const accountNode = document.getElementById("header-account");
  if (!accountNode) {
    return;
  }

  addButton(accountNode);

  let called = false;
  browser.runtime.onMessage.addListener(message => {
    if (called) {
      // There can be some case that the message is received twice or more.
      // Ignore subsequent ones.
      return;
    }
    called = true;

    onResponse(accountNode, message);
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

    browser.runtime.sendMessage({});
    // If browser.runtime.sendMessage doesn't throw, finish.
    clearInterval(timer);
  }
  timer = setInterval(tryQuery, 2000);
  setTimeout(tryQuery, 0);
}
onLoad();
