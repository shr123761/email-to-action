function showGuidedTour() {
    // Create a container for the tutorial
    const tutorialContainer = document.createElement('div');
    tutorialContainer.style = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background-color: #fff;
      padding: 20px;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
      border-radius: 8px;
      z-index: 9999;
      max-width: 400px;
      text-align: center;
    `;
  
    // Add the welcome message
    tutorialContainer.innerHTML = `
      <h2>Welcome to Gmail Email Extractor</h2>
      <p>This extension helps you quickly extract details from your Gmail emails.</p>
      <p>Here’s how it works:</p>
      <ul>
        <li>Shows the sender and subject of your emails</li>
        <li>Lets you send selected emails to your task manager</li>
      </ul>
      <div id="arrow-container" style="margin: 20px 0;">
        <span style="font-size: 30px; color: #1a73e8;">⬇️</span>
      </div>
      <p>Click on the video below for a full tutorial.</p>
      <button id="closeTutorialBtn" style="padding: 10px 20px; background-color: #1a73e8; color: white; border: none; border-radius: 5px; cursor: pointer;">Close Tutorial</button>
    `;
  
    document.body.appendChild(tutorialContainer);
  
    // Add functionality to close the tutorial
    document.getElementById('closeTutorialBtn').addEventListener('click', () => {
      tutorialContainer.remove(); // Remove tutorial
      showLocalTutorialVideo();  // Show video
    });
  
    // Set a flag to remember if tutorial has been shown
    chrome.storage.local.set({ tutorialShown: true });
  }
  
  function showLocalTutorialVideo() {
      document.querySelector('video')?.remove();
  document.getElementById('closeTutorialBtn')?.remove();

    const video = document.createElement("video");
    video.src = chrome.runtime.getURL("tutorial.mp4");
    video.controls = true;
    video.autoplay = true;
    video.muted = true;
  
    video.style = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 320px;
      height: 180px;
      border-radius: 12px;
      z-index: 9999;
      box-shadow: 0 4px 16px rgba(0,0,0,0.3);
    `;
  
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "✖";
    closeBtn.style = `
      position: fixed;
      bottom: 208px;
      right: 24px;
      background: red;
      color: white;
      border: none;
      border-radius: 50%;
      font-size: 14px;
      width: 28px;
      height: 28px;
      cursor: pointer;
      z-index: 10000;
    `;
  
    closeBtn.addEventListener("click", () => {
      video.remove();
      closeBtn.remove();
    });
  
    document.body.appendChild(video);
    document.body.appendChild(closeBtn);
  }
  
  chrome.storage.local.get("tutorialShown", (result) => {
    if (!result.tutorialShown) {
      setTimeout(() => {
        showGuidedTour();
      }, 2000); // Show after 2s for the Welcome Message and Overview
    }
  });
  