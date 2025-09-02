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
  if (currentUrl && universityInput) {
    const response = await fetch("http://127.0.0.1:5000/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        url: currentUrl,
        university: universityInput
      })
    });

    if (response.status != 200){
      console.error("A mistake was made");
    }

    const data = await response.json();
    let words = [];
    // if (data.ai_response) {
    //   data.ai_response = data.ai_response.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); //replacing ** with <strong> tag for full text
    //   words = data.ai_response.split(' '); //splitting into a list of words to display one by one
    // }
    // result.innerHTML = '';
    // for (let i = 0; i < words.length; i++) {
    //   await new Promise(resolve => setTimeout(resolve, 200));
    //   result.innerHTML += words[i] + ' ';
    // }
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

