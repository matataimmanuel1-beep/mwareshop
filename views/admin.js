<!DOCTYPE html>
<html>
<head><title>Admin Dashboard</title></head>
<body>
    <h1>Admin Control Panel</h1>
    <a href="/">View Store</a>
    
    <h2>Add New Product</h2>
    <form action="/admin/add-product" method="POST" enctype="multipart/form-data">
        <input type="text" name="title" placeholder="Product Title" required><br><br>
        <input type="number" step="0.01" name="price" placeholder="Price" required><br><br>
        <textarea name="description" placeholder="Product Details"></textarea><br><br>
        <input type="file" name="image" accept="image/*" required><br><br>
        <button type="submit">Publish Product</button>
    </form>

    <h2>Control Contact Page Details</h2>
    <form action="/admin/update-contact" method="POST">
        <input type="email" name="email" value="<%= info.email %>" required><br><br>
        <input type="text" name="phone" value="<%= info.phone %>" required><br><br>
        <input type="text" name="address" value="<%= info.address %>" required><br><br>
        <button type="submit">Update Contact Info</button>
    </form>
</body>
</html>

