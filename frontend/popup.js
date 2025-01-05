document.getElementById("verifyButton").addEventListener("click", async () => {
  const url = document.getElementById("url").value;
  if (!url) {
    alert("Please enter a URL.");
    return;
  }

  // Call the backend API
  const response = await fetch("http://127.0.0.1:5000/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: url })
  });

  if (response.status != 200){
    console.error("A mistake was made")
  }

  const data = await response.json()
  const urlback = String(data.url)

  const result = document.getElementById('result')
  if (urlback){
    result.textContent = urlback
  }

});
