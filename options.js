const tokenPattern = /api-.*/;

async function saveOptions(e) {
  e.preventDefault();

  browser.storage.local.set({
    "token": document.getElementById("token").value
  });
}

async function restoreOptions() {
  try {
    const { token } = await browser.storage.local.get("token");
    if (tokenPattern.test(token)) {
      document.getElementById("token").value = token;
      return;
    }
  } catch (e) {
  }
  document.getElementById("token").value = "";
}

async function clearPhid() {
  await browser.storage.local.remove("phid");
}

document.addEventListener("DOMContentLoaded", restoreOptions);
document.getElementById("options").addEventListener("submit", saveOptions);
document.getElementById("clear-phid").addEventListener("click", clearPhid);
