import serialosc, { Grid } from "jsr:@capogreco/monome-deno"

// requres serialosc to be running
// brew service start serialosc

serialosc.on("device:add", async deviceInfo => {
   if (deviceInfo.type !== "grid") return
   
   // Create a Grid instance
   const grid = new Grid (serialosc)
   grid.config (deviceInfo)
   
   // Start the grid
   await grid.start ()
   
   // Listen for key presses
   grid.on ("key", async data => {
      console.log (`Button pressed: x=${ data.x }, y=${ data.y }, state=${ data.s }`)
      
      // Light up the button to match its state
      await grid.set (data.x, data.y, data.s)
   })
   
   // Clear the grid
   await grid.all (0)
});
  
// Start serialosc client
await serialosc.start ()
