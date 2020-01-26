
function processImage( image ) {
   var canvas = document.createElement( "canvas" )
   canvas.width  = image.width;
   canvas.height = image.height;
   canvas.getContext( "2d" ).drawImage( image, 0, 0, image.width, image.height );
   var pixelData = canvas.getContext( "2d" ).getImageData( 0, 0, image.width, image.height ).data;
   console.log( pixelData );
   var cellHeight = image.height;
   var gutter_start = 0;
   for( var y = 0; y < image.height; y++ ) {
      for( var x = 0; x < 100; x++ ) {
         var b = pixelData[x + y * image.width * 4 + 0]
         var a = pixelData[x + y * image.width * 4 + 3]
         if( b >= 250 && a >= 250 ) {
            gutter_start = Math.max( gutter_start, y );
         }
      }
   }
   console.log( gutter_start );
   
   // The width of the characters.
   
   var cellWidths  = [];
   var cellStarts  = [];
   var cellOffsets = [];
   
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