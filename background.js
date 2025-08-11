// Listen for the browser action (button) click
browser.browserAction.onClicked.addListener(handleClick);

function handleClick() {
  // Execute the content script in the active tab
  browser.tabs.executeScript({
    file: "content.js"
  }).then(results => {
    // The content script returns the HTML, which is in the first element of the results array
    const htmlContent = results[0];
    if (htmlContent) {
      sendHtmlToApi(htmlContent);
    } else {
      notify("Error", "Could not extract HTML from the page.");
    }
  }).catch(error => {
    console.error(error);
    notify("Error", "Failed to execute content script.");
  });
}

async function sendHtmlToApi(html) {
  const endpoint = 'http://0.0.0.0:8000/html_extract'; // <-- IMPORTANT: Replace with your actual API endpoint

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ html: html }),
    });

    const responseData = await response.json();

    if (response.ok) {
      notify("Success", responseData.message);
    } else {
      notify("API Error", responseData.message || "An unknown error occurred.");
    }
  } catch (error) {
    console.error('Error sending data to API:', error);
    notify("Network Error", "Could not connect to the API.");
  }
}

function notify(title, message) {
  browser.notifications.create({
    "type": "basic",
    "iconUrl": browser.extension.getURL("icons/icon-48.png"),
    "title": title,
    "message": message
  });
}