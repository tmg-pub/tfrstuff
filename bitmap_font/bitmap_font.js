
//-----------------------------------------------------------------------------
// Parse an image and produce the font information.
function processImage( image ) {
   // Render the image to a canvas so we can read the pixels.
   var canvas = document.createElement( "canvas" )
   canvas.width  = image.width;
   canvas.height = image.height;
   canvas.getContext( "2d" ).drawImage( image, 0, 0, image.width, image.height );
   var pixelData = canvas.getContext( "2d" ).getImageData( 0, 0, image.width, image.height ).data;
   
   // We look at the first few characters to determine these values, how tall
   //  the font actually is and such, and where the gutter begins (the portion
   //  of the font that dips below the writing line).
   // The gutter is not included when determining the start of characters,
   //  because that part reaches underneath other characters and isn't
   //  considered in the kerning.
   var heightStart = image.height;
   var heightEnd = 0;
   var gutterStart = 0;
   for( var y = 0; y < image.height; y++ ) {
      for( var x = 0; x < 100; x++ ) {
         var b = pixelData[(x + y * image.width) * 4 + 0]
         var a = pixelData[(x + y * image.width) * 4 + 3]
         if( b >= 250 && a >= 250 ) {
            heightStart = Math.min( heightStart, y );
            heightEnd   = Math.max( heightEnd, y );
         }
      }
   }
   
   gutterStart = heightEnd + 1;
   console.log( "Gutter Start:", gutterStart );
   
   
   var chars = [];
   
   // We switch between four states finding different indexes of each
   //  character.
   // OuterLeft/Right are the horizontal pixel positions of the outer bounding
   //  box (that encapsulates the full size of the character's graphic).
   // InnerLeft/Right are the horizontal pixel positions that mark the start
   //  and end of the character. For "j" this is just the vertical beam
   //  excluding what dips below the gutter, and any text effects are ingored.
   var state = "start_outer";
   
   var charOuterLeft;
   var charOuterRight;
   var charInnerLeft;
   var charInnerRight;
   
   function processLine( x, strongPixels, weakPixels ) {
      // `strongPixels` is how many fully opaque (within reason) white pixels
      //  are found.
      // `weakPixels` is how many pixels that are not completely transparent.
      // `x` is the horizontal position in the font image for this line.
      switch( state ) {
      case "start_outer":
         if( weakPixels > 0 ) {
            state = "start_inner";
            charOuterLeft = x;
         } else {
            break;
         }
         // Note that for these cases, each one passes into the next condition
         //  block if the state changes - sometimes a line fulfills the
         //  criteria of multiple of these states.
      case "start_inner":
         if( strongPixels >= 5 ) {
            state = "end_inner";
            charInnerLeft = x;
         } else {
            break;
         }
      case "end_inner":
         if( strongPixels < 5 ) {
            state = "end_outer";
            charInnerRight = x;
         } else {
            break;
         }
      case "end_outer":
         if( weakPixels == 0 ) {
            state = "start_outer";
            charOuterRight = x;
            
            chars.push({
               outerLeft: charOuterLeft,
               innerLeft: charInnerLeft,
               innerRight: charInnerRight,
               outerRight: charOuterRight
            });
         } else {
            break;
         }
      }
   }
   
   // Scan through the image horizontally and pass data to processLine.
   for( var x = 0; x < image.width; x++ ) {
      var strongPixels = 0;
      var weakPixels   = 0;
      for( var y = 0; y < image.height; y++ ) {
         var b = pixelData[(x + y * image.width) * 4 + 0];
         var a = pixelData[(x + y * image.width) * 4 + 3];
         if( b >= 250 && a >= 250 && y < gutterStart ) {
            // Almost fully white and opaque.
            // The shapes image should be rendered with full white over the
            //  character regions, and any effects as black.
            strongPixels++;
         }
         if( a > 3 ) {
            // Anything not transparent.
            weakPixels++;
         }
      }
      processLine( x, strongPixels, weakPixels );
   }
   
   console.log( "Characters", chars );
   
   var output = [];
   function print( line ) {
      output.push( line );
   }
   
   // 4 values will be used on the program side:
   // • Background offset
   // • Width of div
   // • Left margin
   // • Right margin
   
   var letters = $("#letters").val().replace( /\s/g, "" );
   
   print( "var font_info = {" );
   print( `   letters: "${letters}",` );
   print( `   width: ${image.width},` );
   print( `   height: ${image.height},` );
   print( `   vertical_start: ${heightStart},` );
   print( `   vertical_end: ${heightEnd},` );
   print( `   vertical_size: ${heightEnd+1-heightStart},` );
   print( "   chars: [" );
   
   for( var i = 0; i < chars.length; i++ ) {
      // Be careful for off-by-one errors.
      // We want to include one extra pixel for the bounding boxes, which may
      //  be helpful to render clean glyphs if the font is scaled.
      var bgOffset = chars[i].outerLeft - 1;
      var marginLeft = chars[i].innerLeft - bgOffset;
      var width = chars[i].outerRight + 1 - bgOffset;
      var marginRight = (chars[i].outerRight + 1) - chars[i].innerRight;
      var comma = i == chars.length-1 ? "" : ",";
      var letter = letters[i];
      
      print( `      ${-bgOffset}, ${-marginLeft}, ${width}, ${-marginRight}${comma} // ${letter}` );
   }
   
   print( "   ]" );
   print( "};" );
   
   // Send to output.
   $("#output").show();
   $("#output").text( output.join( "\n" ));
}

//-----------------------------------------------------------------------------
// Prevent files dropped on the document from being opened normally in the
//  browser.
$(document).on( 'dragover', e => {
   e.stopPropagation();
   e.preventDefault();
});

$(document).on( 'drop', e => {
   e.stopPropagation();
   e.preventDefault();
});

//-----------------------------------------------------------------------------
$(() => {
   // Setup drag and drop for the dropzone div.
   //
   $("#dropzone").on({
      dragenter : e => {
         $("#dropzone").addClass( "hover" );
      },
      dragleave : e => {
         $("#dropzone").removeClass( "hover" );
      },
      drop : e => {
         $("#dropzone").removeClass( "hover" );
         var files = e.originalEvent.dataTransfer.files;
         console.log( "Fetching", files[0] );
         
         // Read the file, load it as an image, and pass it to our main
         //  processor.
         var fr = new FileReader();
         fr.onload = e => {
            console.log( "File loaded!" );
            var img = new Image;
            img.onload = e => {
               console.log( "Image loaded!" );
               processImage( img );
            }
            img.src = e.target.result;
         }
         fr.readAsDataURL( files[0] );
      }
   });
})