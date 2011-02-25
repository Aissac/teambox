if ( typeof( window['Teambox'] ) == "undefined" ) {
  window.Teambox = {};
}

Teambox.Notification = function(data, action) {
  this.data = data;
  this.action = action;
};

Teambox.Notification.prototype.notify = function(callback) {
  this.action();
  callback();
};

Teambox.NotificationsBuffer = function() {
  this.notifications = [];
  this.windowEntryTemplate = Handlebars.compile(Templates.notifications.entry);
};

Teambox.NotificationsBuffer.prototype.toggleNotificationsIcon = function() {
  if (this.notificationsIcon) {
    var icon = this.notificationsIcon;
    if (icon.getStyle('opacity') === 1) {
      icon.removeClassName('active');
    }
    else {
      icon.addClassName('active');
    }
  }
};

Teambox.NotificationsBuffer.prototype.toggleNotificationWindow = function(force) {
  if (this.notificationsWindow) {
    if (!this.notificationsWindow.visible()) {
      if (this.notifications.length > 0) {
        this.notificationsWindow.toggle();
        this.toggleNotificationsIcon();
        var self = this;
        if (!force) {
          setTimeout(function() {
            self.notificationsWindow.toggle();
          }, 1000*10);
        }
      }
    }
    else {
      this.notificationsWindow.toggle();
    }
  }
};

//Add notification but flush if we reach 5 unread notifications
Teambox.NotificationsBuffer.prototype.addNotificationWindowEntry = function(notification) {
  if (notification.data) {
    var markup = this.windowEntryTemplate({ activity: notification.data });
    this.notificationsWindow.down('ul').insert({bottom: markup});
  }
};

Teambox.NotificationsBuffer.prototype.clearNotificationWindow = function() {
  this.notificationsWindow.down('ul').childElements().each(function(e) {e.remove();});
};

Teambox.NotificationsBuffer.prototype.addNotification = function(notification) {
  if (this.notifications.length < 5) {
    this.notifications.push(notification);
    this.addNotificationWindowEntry(notification);
    this.toggleNotificationWindow();
  }
  else {
    this.flushAll(true);
  }
};

Teambox.NotificationsBuffer.prototype.flushAll = function(nonotify, scrollToId) {
  var flushBuffer = this.notifications.clone();
  this.notifications.clear();
  for (var i = 0; i < flushBuffer.length; i++) {
    var notification = flushBuffer.shift();
    if (!nonotify) {
      notification.notify(function() {
        if (scrollToId && $(scrollToId)) {
          Effect.ScrollTo(scrollToId, {duration: 0.2, offset: -100});
          new Effect.Highlight(scrollToId, { startcolor: '#ffff99', endcolor: '#ffffff', queue: 'end' });
        }
      });
    }
  };
  this.toggleNotificationWindow(true);
  this.clearNotificationWindow();
  this.toggleNotificationsIcon();

};

Teambox.Notifications = new Teambox.NotificationsBuffer();

Teambox.ActivityNotifier = {
  notificationForComments: function(activity) {
    return new Teambox.Notification(activity, function() {
      var thread = $("thread_" + activity.comment_target_type.toLowerCase() + '_' + activity.comment_target_id);
      if (thread) {
        var comment = thread.down('#comment' + activity.target_id);

        if (activity.action === 'create') {
          var comments = thread.down('.comments');
          if (comments) {
            comments.insert({bottom: activity.markup});
          }
        }
        else if (comment) {
          if (activity.action === 'delete') {
            comment.remove();
          }
          else {
            Element.replace(comment, activity.markup);
          }
        }
      }
    });
  },
  notificationForThreads: function(activity) {
    return new Teambox.Notification(activity, function() {
      var threads = $('activities'),
          thread = $("thread_" + activity.target_type.toLowerCase() + '_' + activity.target_id);

      if (thread) {
        if (activity.action === 'delete') {
          thread.remove();
        }
        else {
          Element.replace(thread, activity.markup);
        }
      }
      else {
        if (activity.action === 'create') {
          threads.insert({top: activity.markup});
        }
      }
    });
  },
  notificationForOthers: function(activity) {
    return new Teambox.Notification(activity, function() {
      var threads = $('activities');

      if (thread) {
        if (activity.action === 'delete') {
          thread.remove();
        }
        else {
          Element.replace(thread, activity.markup);
        }
      }
      else {
        if (activity.action === 'create') {
          threads.insert({top: activity.markup});
        }
      }
    });
  },
  notifyActivity: function(activity) {
    var notification = false;

    if (activity.target_type === 'Comment') {
        notification = this.notificationForComments(activity);
    }
    else if (['Conversation', 'Task', 'TaskList'].indexOf(activity.target_type) > 0) {
        notification = this.notificationForThreads(activity);
    }
    else {
        notification = this.notificationForOthers(activity);
    }

    if (notification) {
      Teambox.Notifications.addNotification(notification);
    }
  }
};

document.on('click', '#show_new_content a', function(e) {
  e.preventDefault();

  var target = e.target,
      element_id = false;

  if (target) {
    element_id = target.readAttribute('data-activity-id');
  }

  Teambox.Notifications.flushAll(false, element_id);
});

document.on('click','#header_icons li.notifications_icon a', function(e) {
  e.preventDefault();
  Teambox.Notifications.toggleNotificationWindow();
});

document.on('dom:loaded', function() {

  Teambox.Notifications.notificationsWindow = $(document.body).down('#show_new_content');
  Teambox.Notifications.notificationsIcon = $(document.body).down('#header_icons li.notifications_icon a');

  if (Teambox.Notifications.notificationsIcon) {
  }

  Teambox.pushServer.on('connect', function() {
    console.log("connected: ", this.socket.transport.sessionid);
  });

  Teambox.pushServer.on('disconnect', function() {
    console.log("disconnected: ");
  });


  if (window.my_user) {
    Teambox.pushServer.subscribe("/users/" + my_user.authentication_token, function(message){
      try {
        var activity = JSON.parse(message);
        console.log("Received activity: ", activity);
        if (activity.user_id != my_user.id) {
          Teambox.ActivityNotifier.notifyActivity(activity);
        }
      }
      catch(err) {
        console.log('[Push Error]'  + err + ' parsing: ', message);
      }
    });
  }
});

