chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "sendTaskToConverge") {
    const taskData = message.data;
    const emailKey = message.emailKey;

    chrome.storage.local.get([emailKey], (result) => {
      if (result[emailKey]) {
        console.log(`⚠️ Task for ${emailKey} already sent.`);
        sendResponse({ success: false, error: "Task already sent" });
        return;
      }

      fetch("https://convergedev-stage.azurewebsites.net/api/integration/testemailactionrequest10122", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taskData)
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP ${response.status} - ${response.statusText}`);
          }
          return response.json().catch(() => ({})); // avoid JSON parse crash
        })
        .then((result) => {
          console.log("📩 API Response:", result);

          // Handle boolean true/false OR Success/Error objects
          if (result === true || result.Success === "true" || result.success === true) {
            chrome.storage.local.set({ [emailKey]: taskData }, () => {
              sendResponse({ success: true, result });
            });
          } else {
            sendResponse({
              success: false,
              error: result.Error || result.error || "Unknown API error"
            });
          }
        })
        .catch((error) => {
          console.error("❌ Failed to send task:", error);
          sendResponse({ success: false, error: error.message });
        });
    });

    return true;
  }
});
