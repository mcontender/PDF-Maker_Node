$(document).ready(function() {
    $('#button').click(function() {
        // run an AJAX get request to the route you setup above...
        // respect the cross-domain policy by using the same domain
        // you used to access your index.html file!
        try {
            console.log('test click');
            var url = $('#url').val();
            var psw = $('#brandPsw').val();
            var path = 'http://localhost:3000/snap?url=' + url + '&psw=' + psw;

            //TODO: Add validation and error for URL field
            //TODO: Add support for password page\
            console.log(path);
            $.get(path, function(response) {
                console.log(response);
                $('#response').html(response); // show the list
            });
        } catch (err) {
            console.log(err);
        }
    });

    $("#url").on("input", function() {
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