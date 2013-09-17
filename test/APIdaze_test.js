test( "hello test", function() {
  ok( 1 == "1", "Passed!" );
});

test( "CLIENT", function() {
  throws(
    function() {new APIdaze.CLIENT({type: "hello"});},
    APIdaze.Exceptions.ConfigurationError,
    'Error("Wrong parameter : type. \'auto\',\'webrtc\',\'flash\' are accepted.")'
  );

  var client = new APIdaze.CLIENT({type: "auto"});

  equal(client.status, APIdaze.CLIENT.CONSTANTS.STATUS_INIT);
});

