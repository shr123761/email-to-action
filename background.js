chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "sendTaskToConverge") {
    const taskData = message.data;
    const emailKey = message.emailKey;

    console.log("📬 Sending task for:", emailKey);
    console.log("Payload:", taskData);

    chrome.storage.local.get([emailKey], (result) => {
      if (chrome.runtime.lastError) {
        console.error("Storage get error:", chrome.runtime.lastError);
        sendResponse({ success: false, error: "Storage get error" });
        return;
      }

      if (result[emailKey]) {
        console.log(`⚠️ Task for ${emailKey} already sent.`);
        sendResponse({ success: false, error: "Task already sent" });
        return;
      }

      const url = "https://convergedev-test.azurewebsites.net/api/integration/submitemailactionrequest10122"
      const fetchOptions = {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(taskData)
      };

      console.log("🔗 Sending POST request to:", url);
      console.log("Headers:", fetchOptions.headers);

      fetch(url, fetchOptions)
        .then((response) => {
          console.log(`HTTP Status: ${response.status} - ${response.statusText}`);
          if (!response.ok) throw new Error(`HTTP ${response.status} - ${response.statusText}`);
          return response.json().catch(() => {
            console.warn("⚠️ Response not JSON, returning empty object");
            return {};
          });
        })
        .then((result) => {
          console.log("📩 Full API Response:", result);

          // Detect success robustly
          const success =
            result === true ||
            result === "true" ||
            result.Success === true ||
            result.Success === "true" ||
            result.success === true ||
            result.success === "true";

          if (success) {
            chrome.storage.local.set({ [emailKey]: taskData }, () => {
              if (chrome.runtime.lastError) {
                console.error("Storage set error:", chrome.runtime.lastError);
              }
              console.log(`✅ Task ${emailKey} saved locally`);
              sendResponse({ success: true, result });
            });
          } else {
            console.warn("❌ Task not saved by API:", result);
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

    return true; // keeps sendResponse valid asynchronously
  }
});
