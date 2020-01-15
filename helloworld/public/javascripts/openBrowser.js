$(document).ready(function() {
    $('#button').click(function() {
        // run an AJAX get request to the route you setup above...
        // respect the cross-domain policy by using the same domain
        // you used to access your index.html file!
        var url = $('#url').val();
        var path = 'http://localhost:3000/snap?url=' + url;
        //TODO: Add validation and error for URL field
        //TODO: Add support for password page
        $.get(path, function(response) {
            $('#response').html(response); // show the list
        });
    });
});