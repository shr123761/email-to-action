document.addEventListener('DOMContentLoaded', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript(
      {
        target: { tabId: tabs[0].id },
        func: extractEmailDetailsFromPage,
      },
      (results) => {
        if (chrome.runtime.lastError || !results || !results[0]) {
          console.error('Failed to retrieve email details');
          return;
        }

        const emailList = results[0].result;
        const container = document.getElementById('emailContainer');
        container.innerHTML = '';

        if (emailList.length === 0) {
          container.innerHTML = 'No emails found or unable to extract data.';
          return;
        }

        let selectedEmail = null;
        const unitNotesContainer = document.getElementById('unitNotesContainer');
        unitNotesContainer.style.display = 'none';

        const sendButton = document.getElementById('sendButton');
        const validationMessage = document.getElementById('validationMessage');
        const unitInput = document.getElementById('unitInput');
        const condoCodeInput = document.getElementById('condoCode');
        const typeSelect = document.getElementById('typeSelect');

        function updatePreview() {
          if (!selectedEmail) return;

          validationMessage.style.display = 'none';

          const unit = unitInput.value.trim();
          const condoCode = (condoCodeInput.value || '').toUpperCase().slice(0, 3);
          const type = typeSelect.value;

          condoCodeInput.value = condoCode;

          // Update preview fields
          document.getElementById('previewSubject').textContent = selectedEmail.subject;
          document.getElementById('previewDate').textContent = selectedEmail.date;
          document.getElementById('previewBody').textContent = selectedEmail.body;
          document.getElementById('previewCondoCode').textContent = condoCode;
          document.getElementById('previewUnit').textContent = unit;
          document.getElementById('previewType').textContent = type;

          const isValid = unit !== '' && condoCode !== '' && type !== '';
          window.emailDataToSend = isValid ? {
            ...selectedEmail,
            condoCode,
            unit,
            type
          } : null;
        }

        // Real-time listeners
        unitInput.addEventListener('input', updatePreview);
        condoCodeInput.addEventListener('input', updatePreview);
        typeSelect.addEventListener('change', updatePreview);

        // Render emails
        emailList.forEach((email, i) => {
          const emailKey = `${email.date}-${email.subject}-${email.senderEmail}-${i}`;
          const div = document.createElement('div');
          div.classList.add('email-card');

          div.innerHTML = `
            <hr>
            <strong>Email #${i + 1}</strong><br>
            <strong>From:</strong> ${email.senderName}<br>
            <strong>Subject:</strong> ${email.subject}<br>
            <strong>Date:</strong> ${email.date}<br>
            <strong>Body:</strong>
            <div style="white-space: pre-wrap; margin-left: 10px;">${email.body}</div>
          `;

          container.appendChild(div);

          div.addEventListener('click', () => {
            selectedEmail = { ...email, key: emailKey };

            document.querySelectorAll('.email-card').forEach(card => card.classList.remove('selected'));
            div.classList.add('selected');

            unitInput.value = '';
            condoCodeInput.value = '';
            typeSelect.value = '';

            unitNotesContainer.style.display = 'block';
            document.getElementById('previewContainer').style.display = 'block';

            updatePreview();

            // Restore saved state if exists
            chrome.storage.local.get([selectedEmail.key], (result) => {
              const savedData = result[selectedEmail.key];

              if (savedData) {
                sendButton.disabled = true;
                sendButton.innerText = "Email Already Sent";

                unitInput.value = savedData.unit || '';
                condoCodeInput.value = savedData.condoCode || '';
                typeSelect.value = savedData.type || '';

                selectedEmail = { ...selectedEmail, ...savedData, key: selectedEmail.key };
                updatePreview();
              } else {
                sendButton.disabled = false;
                sendButton.innerText = "Send Email Data to Converge";
                unitInput.value = '';
                condoCodeInput.value = '';
                typeSelect.value = '';
                updatePreview();
              }
            });
          });

          if (i === 0) div.click();
        });

        // Send button handler
        sendButton.addEventListener('click', () => {
          if (!window.emailDataToSend) {
            validationMessage.style.display = 'block';
            validationMessage.textContent = 'Please fill all the fields.';
            alert('Please fill all the fields.');
            return;
          }

          validationMessage.style.display = 'none';
          const { senderEmail, subject, date, body, condoCode, unit, type, key } = window.emailDataToSend;

          const payload = {
            To: "dean@convergecondo.com",
            From: senderEmail,
            Title: subject,
            Date: date,
            Unit: unit,
            Type: type,
            Condo: condoCode,
            Details: body
          };

          chrome.runtime.sendMessage({
            action: "sendTaskToConverge",
            emailKey: key,
            data: payload
          }, (response) => {
            if (response?.success) {
              const dataToStore = {};
              dataToStore[key] = payload;

              chrome.storage.local.set(dataToStore, () => {
                alert('✅ Data sent successfully to Converge and saved!');
                sendButton.disabled = true;
                sendButton.innerText = "Task Already Sent";
              });
            } else {
              alert('❌ Failed to send data: ' + (response?.error || 'Unknown error'));
              if (response?.error === "Task already sent") {
                sendButton.disabled = true;
                sendButton.innerText = "Task Already Sent";
              }
            }
          });
        });
      }
    );
  });

  document.getElementById("resetTutorialBtn").addEventListener("click", () => {
    chrome.storage.local.remove("tutorialShown", () => {
      alert("✅ Tutorial reset. It will show again next time.");
    });
  });
});

// Extract Gmail email details inside the tab
function extractEmailDetailsFromPage() {
  try {
    const emailNodes = document.querySelectorAll('div[role="listitem"]');
    const emails = [];

    emailNodes.forEach((node) => {
      const senderName = node.querySelector('.gD')?.textContent || 'Unknown Sender';
      const senderEmail = node.querySelector('.gD')?.getAttribute('email') || 'unknown@example.com';
      const subject = document.querySelector('h2.hP')?.textContent || 'No Subject';
      const date = node.querySelector('.g3[title]')?.getAttribute('title') || 'No Date';

      const bodyElement = node.querySelector('.a3s');
      let body = 'No Body';
      if (bodyElement) {
        let rawBody = bodyElement.innerText || '';
        const cleanedLines = rawBody.split('\n').filter(line => {
          return !/^On\s.+wrote:$/i.test(line.trim()) && line.trim() !== '';
        });
        body = cleanedLines.join('\n').trim();
      }

      emails.push({ senderName, senderEmail, subject, date, body });
    });

    return emails;
  } catch (e) {
    console.error('Error extracting emails:', e);
    return [];
  }
}
