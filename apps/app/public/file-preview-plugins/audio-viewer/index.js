window['audio-viewer'] = {
  async render(context) {
    const { container, fileUrl, fileType, api } = context;

    try {
      api.showLoading();

      // Create audio player container
      const audioContainer = document.createElement('div');
      audioContainer.className = 'audio-viewer';

      // Create audio element
      const audio = document.createElement('audio');
      audio.controls = true;
      audio.className = 'audio-player';
      audio.preload = 'metadata';

      // Create audio source using fileUrl
      const source = document.createElement('source');
      source.src = fileUrl;
      source.type = `audio/${fileType}`;

      // Add error message
      const errorMessage = document.createElement('p');
      errorMessage.className = 'audio-error';
      errorMessage.textContent = 'Your browser does not support this audio format.';

      // Assemble audio player
      audio.appendChild(source);
      audio.appendChild(errorMessage);
      audioContainer.appendChild(audio);

      // Clear container and add new audio player
      container.innerHTML = '';
      container.appendChild(audioContainer);

      // Audio loading error handling
      audio.onerror = error => {
        console.error('Audio loading error:', error);
        api.showError('Failed to load audio');
      };

      // Audio loading complete handling
      audio.onloadeddata = () => {
        api.hideLoading();
      };

      // Audio can play handling
      audio.oncanplay = () => {
        api.hideLoading();
      };

    } catch (error) {
      console.error('Audio rendering error:', error);
      api.showError('Failed to render audio');
      api.hideLoading();
    }
  },
};
