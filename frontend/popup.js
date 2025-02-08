function getCurrentTab() {
  // This callback is passed two arguments:
  // a resolve callback used to resolve the promise with a value 
  // or a reject callback used to reject the promise with a provided reason or error
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        resolve(tabs[0].url)
      }
      else{
        reject("No current tab found");
      }
  });
});
}

document.getElementById("scanButton").addEventListener("click", async () => {

  const currentUrl = await getCurrentTab();
  const result = document.getElementById('scan_result')
  result.textContent = ''

  // Call the backend API
  if (currentUrl) {
    const response = await fetch("http://127.0.0.1:5000/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: currentUrl })
    });

    if (response.status != 200){
      console.error("A mistake was made")
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

    if (data.contacts) {
      const contactsList = document.createElement('ul');
      data.contacts.forEach(contact => {
        const listItem = document.createElement('li');
        listItem.innerHTML = '<a href="' + contact + '">' + contact + '</a>';
        contactsList.appendChild(listItem);
      });
      result.appendChild(contactsList);
    }

    }
  }
);

document.getElementById("uploadButton").addEventListener("click", async () => {
  const fileInput = document.getElementById("fileInput");
  const file = fileInput.files[0];

  if (file) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("http://127.0.0.1:5000/file", {
      method: "POST",
      body: formData
    });

    if (response.status != 200) {
      console.error("A mistake was made");
    } else {
      const data = await response.json();
      const result = document.getElementById('resume_result');
      result.textContent = data.skills ? data.skills : '';
    }
  } else {
    console.error("No file was uploaded");
  }
});

document.getElementById("compareButton").addEventListener("click", async () => {
  const fileInput = document.getElementById("fileInput");
  const file = fileInput.files[0];
  const currentUrl = await getCurrentTab();
  const result = document.getElementById('compare_result');
  result.textContent = '';

  if (file && currentUrl) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("url", currentUrl);

    const response = await fetch("http://127.0.0.1:5000/compare", {
      method: "POST",
      body: formData
    });

    if (response.status != 200) {
      console.error("A mistake was made");
    } 
    else {
      const data = await response.json();
      if (data.ai_response) {
        data.ai_response = data.ai_response.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); //replacing ** with <strong> tag for full text
        words = data.ai_response.split(' ');
      }
      for (let i = 0; i < words.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 200));
        result.innerHTML += words[i] + ' ';
      }
    }
  }
  else {
    console.error("No file or URL was provided");
  }
});
