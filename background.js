// Listen for clicks on the browser action (the toolbar button).
browser.action.onClicked.addListener(() => {
  // When the button is clicked, toggle the sidebar's visibility.
  browser.sidebarAction.toggle();
});