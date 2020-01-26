
function processImage( image ) {
   var canvas = document.createElement( "canvas" )
   canvas.width  = image.width;
   canvas.height = image.height;
   canvas.getContext( "2d" ).drawImage( image, 0, 0, image.width, image.height );
   var pixelData = canvas.getContext( "2d" ).getImageData( 0, 0, image.width, image.height ).data;
   
   var cellHeight = image.height;
   var height_start = image.height;
   var height_end = 0;
   var gutter_start = 0;
   for( var y = 0; y < image.height; y++ ) {
      for( var x = 0; x < 100; x++ ) {
         var b = pixelData[(x + y * image.width) * 4 + 0]
         var a = pixelData[(x + y * image.width) * 4 + 3]
         if( b >= 250 && a >= 250 ) {
            height_start = Math.min( height_start, y );
            height_end   = Math.max( height_end, y );
            
         }
      }
   }
   
   gutter_start = height_end + 1;
   console.log( "Gutter Start:", gutter_start );
   
   // The width of the characters.
   
   var chars = [];
   
   var state = "start_outer";
   
   var charOuterLeft;
   var charOuterRight;
   var charInnerLeft;
   var charInnerRight;
   
   function processLine( x, strongPixels, weakPixels ) {
      switch( state ) {
      case "start_outer":
         if( weakPixels > 0 ) {
            state = "start_inner";
            charOuterLeft = x;
         } else {
            break;
         }
      case "start_inner":
         if( strongPixels >= 3 ) {
            state = "end_inner";
            charInnerLeft = x;
         } else {
            break;
         }
      case "end_inner":
         if( strongPixels < 3 ) {
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
   
   for( var x = 0; x < image.width; x++ ) {
      var strongPixels = 0;
      var weakPixels = 0;
      for( var y = 0; y < image.height; y++ ) {
         var b = pixelData[(x + y * image.width) * 4 + 0];
         var a = pixelData[(x + y * image.width) * 4 + 3];
         if( b >= 250 && a >= 250 && y < gutter_start ) {
            strongPixels++;
         }
         if( a > 3 ) {
            weakPixels++;
         }
      }
      processLine( x, strongPixels, weakPixels );
   }
   
   console.log( chars );
   
   var output = [];
   function print( line ) {
      output.push( line );
   }
   
   // 3 values will be used on the program side
   // background offset
   // width of div
   // left margin
   // right margin
   
   var letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
   
   print( "var font_info = {" )
   
   print( `   letters: "${letters}",` );
   print( `   width: ${image.width},` );
   print( `   height: ${image.height},` );
   print( `   vertical_start: ${height_start},` );
   print( `   vertical_end: ${height_end},` );
   print( `   vertical_size: ${height_end+1-height_start},` );
   print( "   chars: [" );
   for( var i = 0; i < chars.length; i++ ) {
      
      var bgOffset = chars[i].outerLeft - 1;
      var marginLeft = chars[i].innerLeft - bgOffset;
      var width = chars[i].outerRight + 1 - bgOffset;
      var marginRight = (chars[i].outerRight + 1) - chars[i].innerRight;
      var comma = i == chars.length-1 ? "" : ",";
      print( `      ${-bgOffset}, ${-marginLeft}, ${width}, ${-marginRight}${comma} // ${i}` );
   }
   print( "   ]" );
   print( "};" );
   
      
   // convert into output
   $("#output").show();
   $("#output").text( output.join( "\n" ));
}

$(document).on( 'dragover', e => {
   e.stopPropagation();
   e.preventDefault();
});

$(document).on( 'drop', e => {
   e.stopPropagation();
   e.preventDefault();
});

$(() => {
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