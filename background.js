// background.js

chrome.runtime.onInstalled.addListener(() => {
  console.log("✅ Gmail to Task Creator Extension Installed!");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "sendTaskToBeeceptor") {
    const taskData = message.data;
    const emailKey = message.emailKey;

    // Check if the task was already sent
    chrome.storage.local.get([emailKey], (result) => {
      if (result[emailKey]) {
        console.log(`⚠️ Task for ${emailKey} already sent.`);
        sendResponse({ success: false, error: "Task already sent" });
        return;
      }

      // Send data to Beeceptor
      fetch("https://taskmanagement.free.beeceptor.com", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(taskData),
      })
        .then((response) => response.text())
        .then((result) => {
          console.log("✅ Task sent successfully:", result);
          // Store this task as "already sent"
          chrome.storage.local.set({ [emailKey]: true }, () => {
            sendResponse({ success: true, result });
          });
        })
        .catch((error) => {
          console.error("❌ Failed to send task:", error);
          sendResponse({ success: false, error: error.message });
        });
    });

    return true; // Keeps message channel alive for async response
  }
});
