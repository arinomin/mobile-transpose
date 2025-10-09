self.addEventListener('install', (event) => {
  // Installation logic can go here.
  // For now, we are just making the app installable.
});

self.addEventListener('fetch', (event) => {
  // Fetch logic can go here.
  // For now, we are not caching anything.
});
