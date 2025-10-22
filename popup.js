document.addEventListener('DOMContentLoaded', () => {
  try {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        console.error('Error querying tabs:', chrome.runtime.lastError);
        return;
      }
      if (!tabs || !tabs[0]) {
        console.error('No active tab found');
        return;
      }

      chrome.scripting.executeScript(
        {
          target: { tabId: tabs[0].id },
          func: extractEmailDetailsFromPage,
        },
        (results) => {
          if (chrome.runtime.lastError) {
            console.error('Error executing script:', chrome.runtime.lastError);
            return;
          }
          if (!results || !results[0]) {
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
          const notesInput = document.getElementById('notesInput');

          // Normalize date string to API expected format
          function normalizeDateString(dateStr) {
            if (!dateStr) return '';
            try {
              const parsed = new Date(dateStr);
              if (!isNaN(parsed.getTime())) {
                const options = { month: 'short', day: 'numeric', year: 'numeric' };
                const datePart = parsed.toLocaleDateString('en-US', options);
                const timePart = parsed.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                return `${datePart}, at ${timePart}`;
              }

              const yearMatch = dateStr.match(/(\d{4})/);
              const timeMatch = dateStr.match(/(\d{1,2}:\d{2}\s?(AM|PM))/i);
              if (yearMatch && timeMatch) {
                const idxYearEnd = dateStr.indexOf(yearMatch[0]) + yearMatch[0].length;
                const rest = dateStr.substring(idxYearEnd).trim();
                if (!rest.startsWith(', at')) {
                  return dateStr.substring(0, idxYearEnd) + ', at' + rest;
                }
                return dateStr;
              }

              return dateStr;
            } catch (e) {
              console.error('Error normalizing date:', e);
              return dateStr;
            }
          }

          function updatePreview() {
            if (!selectedEmail) return;

            validationMessage.style.display = 'none';

            const unit = unitInput.value.trim();
            const condoCode = (condoCodeInput.value || '').toUpperCase().slice(0, 3);
            const type = typeSelect.value;

            // Dynamic Notes auto-completion after Unit is filled
            let notes = notesInput.value.trim();
            if (unit) {
              notes = `${selectedEmail.senderName} - ${selectedEmail.senderEmail} - ${unit}`;
              notesInput.value = notes;
            }

            condoCodeInput.value = condoCode;

            const normalizedDate = normalizeDateString(selectedEmail.date);

            // Update preview
            document.getElementById('previewSubject').textContent = selectedEmail.subject;
            document.getElementById('previewDate').textContent = normalizedDate;
            document.getElementById('previewBody').textContent = selectedEmail.body;
            document.getElementById('previewCondoCode').textContent = condoCode;
            document.getElementById('previewUnit').textContent = unit;
            document.getElementById('previewType').textContent = type;
            document.getElementById('previewNotes').textContent = notes;

            const isValid = unit !== '' && condoCode !== '' && type !== '' && notes !== '';
            window.emailDataToSend = isValid
              ? {
                  ...selectedEmail,
                  condoCode,
                  unit,
                  type,
                  notes,
                  normalizedDate
                }
              : null;
          }

          // Real-time listeners
          unitInput.addEventListener('input', updatePreview);
          condoCodeInput.addEventListener('input', updatePreview);
          typeSelect.addEventListener('change', updatePreview);
          notesInput.addEventListener('input', updatePreview);

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
              try {
                selectedEmail = { ...email, key: emailKey };

                document.querySelectorAll('.email-card').forEach((card) =>
                  card.classList.remove('selected')
                );
                div.classList.add('selected');

                unitInput.value = '';
                condoCodeInput.value = '';
                typeSelect.value = '';
                notesInput.value = '';

                unitNotesContainer.style.display = 'block';
                document.getElementById('previewContainer').style.display = 'block';

                updatePreview();

                chrome.storage.local.get([selectedEmail.key], (result) => {
                  if (chrome.runtime.lastError) {
                    console.error('Storage get error:', chrome.runtime.lastError);
                    return;
                  }
                  const savedData = result[selectedEmail.key];
                  if (savedData) {
                    sendButton.disabled = true;
                    sendButton.innerText = 'Email Already Sent';

                    unitInput.value = savedData.Unit || '';
                    condoCodeInput.value = savedData.Condo || '';
                    typeSelect.value = savedData.Type || '';
                    notesInput.value = savedData.Notes || '';
                    updatePreview();
                  } else {
                    sendButton.disabled = false;
                    sendButton.innerText = 'Send Email Data to Converge';
                    updatePreview();
                  }
                });
              } catch (e) {
                console.error('Error selecting email:', e);
              }
            });

            if (i === 0) div.click();
          });

          // Send button
          sendButton.addEventListener('click', () => {
            try {
              if (!window.emailDataToSend) {
                validationMessage.style.display = 'block';
                validationMessage.textContent = 'Please fill all the fields.';
                alert('Please fill all the fields.');
                return;
              }

              validationMessage.style.display = 'none';
              const {
                subject,
                normalizedDate,
                body,
                condoCode,
                unit,
                type,
                notes,
                key
              } = window.emailDataToSend;

              const payload = {
                Title: subject,
                Date: normalizedDate,
                Unit: unit,
                Type: type,
                Condo: condoCode,
                Details: body,
                Notes: notes
              };

              chrome.runtime.sendMessage(
                {
                  action: 'sendTaskToConverge',
                  emailKey: key,
                  data: payload
                },
                (response) => {
                  if (chrome.runtime.lastError) {
                    console.error('Send message error:', chrome.runtime.lastError);
                    alert('❌ Failed to send data due to internal error');
                    return;
                  }
                  if (response?.success) {
                    const dataToStore = {};
                    dataToStore[key] = payload;

                    chrome.storage.local.set(dataToStore, () => {
                      if (chrome.runtime.lastError) {
                        console.error('Storage set error:', chrome.runtime.lastError);
                        alert('❌ Data sent but failed to save locally');
                        return;
                      }
                      alert('✅ Data sent successfully to Converge and saved!');
                      sendButton.disabled = true;
                      sendButton.innerText = 'Task Already Sent';
                    });
                  } else {
                    alert('❌ Failed to send data: ' + (response?.error || 'Unknown error'));
                    if (response?.error === 'Task already sent') {
                      sendButton.disabled = true;
                      sendButton.innerText = 'Task Already Sent';
                    }
                  }
                }
              );
            } catch (e) {
              console.error('Error sending data:', e);
              alert('❌ Unexpected error sending data');
            }
          });
        }
      );
    });
  } catch (e) {
    console.error('Error initializing popup:', e);
  }

  try {
    document.getElementById('resetTutorialBtn').addEventListener('click', () => {
      chrome.storage.local.remove('tutorialShown', () => {
        if (chrome.runtime.lastError) {
          console.error('Error resetting tutorial:', chrome.runtime.lastError);
          return;
        }
        alert('✅ Tutorial reset. It will show again next time.');
      });
    });
  } catch (e) {
    console.error('Error attaching tutorial reset listener:', e);
  }
});

// Extract Gmail email details
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
        const cleanedLines = rawBody.split('\n').filter((line) => {
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
