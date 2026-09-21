function getCurrentTab() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else if (tabs.length === 0) {
        reject("No active tab found");
      } else {
        resolve(tabs[0].url);
      }
    });
  });
}

document.getElementById("scanButton").addEventListener("click", async () => {
  const universityInput = document.getElementById("universityInput").value;
  if (!universityInput) {
    alert("Please enter a university");
    return;
  }

  const currentUrl = await getCurrentTab();
  const result = document.getElementById('scan_result');
  result.textContent = '';

  // Call the backend API
  if (currentUrl) {
    const response = await fetch("http://127.0.0.1:5000/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: currentUrl,
        university: universityInput
      })
    });

    const data = await response.json();
    if (!response.ok) {
      result.textContent = data.error || "Something went wrong.";
      return;
    }
    if (data.contacts.length === 0) {
      result.textContent = "No contacts found.";
      return;
    }
    if (data.contacts && data.links) {
      const contactsList = document.createElement('ul');
      data.contacts.forEach((contact, index) => {
        const listItem = document.createElement('li');
        const link = document.createElement('a');
        link.href = data.links[index];
        link.target = "_blank"
        link.textContent = contact;
        link.style.cursor = "pointer";
        link.addEventListener('click', (e) => {
          e.preventDefault();
          chrome.tabs.create({ url: data.links[index], active: false });
        });
        listItem.appendChild(link);
        contactsList.appendChild(listItem);
      });
      result.appendChild(contactsList);
    }
  }
});
