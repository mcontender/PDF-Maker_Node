$(document).ready(function() {
    $('#button').click(function(event) {
        event.preventDefault();
        // run an AJAX get request to the route you setup above...
        // respect the cross-domain policy by using the same domain
        // you used to access your index.html file!
        try {
            console.log('test click');
            var url = $('#url').val();
            console.log('URL: ' + encodeURI(url));
            var psw = $('#brandPsw').val();
            console.log('Password: ' + psw);
            var path = 'http://localhost:3000/snap?url=' + encodeURI(url) + '&psw=' + psw;
            // var path = 'http://localhost:3000/snap?url=' + url;
            //TODO: Add validation and error for URL field
            //TODO: Add support for password page\
            console.log('Path: ' + path);
            $.get(path, function(response) {
                console.log(response);
                $('#response').html(response); // show the list
            }, "html");
        } catch (err) {
            console.log(err);
        }
    });

    $("#url").on("input", function(event) {
        // Print entered value in a div box
        var value = $(this).val();
        console.log(value);
        if (value.indexOf('preview') >= 0 || value.indexOf('test') >= 0 || value.indexOf('uat') >= 0) {
            $('#brandPsw').removeAttr('disabled');
            $('.brand').removeClass('disabled');
        } else {
            $('#brandPsw').attr('disabled', 'true');
            $('.brand').addClass('disabled');
        }
        //$("#result").text($(this).val());
    })




});