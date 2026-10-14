1. Extract ZIP to a folder.
2. In UXP Developer Tool, Add Plugin -> select manifest.json in uxp-load-test folder.
3. Click Load. In Photoshop, Plugins -> UXP Load Test.
4. If this ALSO fails with Devtools: Failed to load the devtools plugin, investigate UXP Developer Tool setup (admin privileges, developer mode, version, UDT/App Logs).
5. If this loads, Smart Export has plugin-specific startup or manifest issue. Collect the first UDT/App Logs error.
