self.addEventListener('push', function(event) {
    const options = {
        body: event.data ? event.data.text() : 'You have a new update from Mwareshop!',
        icon: '/uploads/shop-icon.png',
        badge: '/uploads/shop-badge.png',
        vibrate:,
        data: { dateOfArrival: Date.now() }
    };

    event.waitUntil(
        self.registration.showNotification('Mwareshop Notification', options)
    );
});

