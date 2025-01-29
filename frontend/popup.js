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

  // Call the backend API
  const response = await fetch("http://127.0.0.1:5000/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: currentUrl })
  });

  if (response.status != 200){
    console.error("A mistake was made")
  }

  const data = await response.json();
  const result = document.getElementById('result')
  if (currentUrl){
    result.textContent = data.skills;
  }

}
);

document.getElementById("uploadButton").addEventListener("click", async() => {


});