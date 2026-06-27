const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const dotenv = require("dotenv");
const cors = require("cors");

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: false,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // await client.connect();

    const db = client.db("mini-erp");

    const productsCollection = db.collection("products");
    const customersCollection = db.collection("customers");
    const purchasesCollection = db.collection("purchases");
    const salesCollection = db.collection("sales");
    const usersCollection = db.collection("user");
    const ordersCollection = db.collection("orders");

    /*
     * ====================================
     * Products API
     * ====================================
     */

    // Add Product
    app.post("/products", async (req, res) => {
      try {
        const product = req.body;

        const newProduct = {
          productName: product.productName,
          sku: product.sku,
          category: product.category,
          supplier: product.supplier,
          purchasePrice: Number(product.purchasePrice),
          sellingPrice: Number(product.sellingPrice),
          stock: Number(product.stock),
          image: product.image || "",
          description: product.description || "",
          status: product.status || "active",
          createdAt: new Date(),
        };

        const result = await productsCollection.insertOne(newProduct);

        res.status(201).send({
          success: true,
          message: "Product added successfully",
          insertedId: result.insertedId,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // Get Products (Public)
    // Search + Category + Price + Sort + Pagination

    app.get("/products", async (req, res) => {
      try {
        const {
          search = "",
          category,
          minPrice,
          maxPrice,
          sort = "newest",
          page = 1,
          limit = 12,
        } = req.query;

        const query = {};

        // Search by product name
        if (search) {
          query.productName = {
            $regex: search,
            $options: "i",
          };
        }

        // Filter by category
        if (category && category !== "All") {
          query.category = category;
        }

        // Filter by selling price
        if (minPrice || maxPrice) {
          query.sellingPrice = {};

          if (minPrice) {
            query.sellingPrice.$gte = Number(minPrice);
          }

          if (maxPrice) {
            query.sellingPrice.$lte = Number(maxPrice);
          }
        }

        // Show only active products
        query.status = "active";

        // Sorting
        let sortOption = {};

        switch (sort) {
          case "priceLow":
            sortOption = { sellingPrice: 1 };
            break;

          case "priceHigh":
            sortOption = { sellingPrice: -1 };
            break;

          case "oldest":
            sortOption = { createdAt: 1 };
            break;

          default:
            sortOption = { createdAt: -1 };
        }

        const skip = (Number(page) - 1) * Number(limit);

        const total = await productsCollection.countDocuments(query);

        const products = await productsCollection
          .find(query)
          .sort(sortOption)
          .skip(skip)
          .limit(Number(limit))
          .toArray();

        res.send({
          success: true,
          total,
          currentPage: Number(page),
          totalPages: Math.ceil(total / Number(limit)),
          products,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // Buy Product - Create Order
    app.post("/orders", async (req, res) => {
      try {
        const order = req.body;

        // Validate required fields
        if (
          !order.productId ||
          !order.productName ||
          !order.quantity ||
          !order.price
        ) {
          return res.status(400).send({
            success: false,
            message:
              "Missing required fields: productId, productName, quantity, price",
          });
        }

        // Create order object
        const newOrder = {
          productId: order.productId,
          productName: order.productName,
          quantity: Number(order.quantity),
          price: Number(order.price),
          totalAmount: Number(order.quantity) * Number(order.price),
          supplier: order.supplier || "",
          status: order.status || "Pending",
          orderDate: order.orderDate || new Date().toISOString(),
          customerName: order.customerName || "Guest User",
          customerEmail: order.customerEmail || "guest@example.com",
          createdAt: new Date(),
        };

        const result = await ordersCollection.insertOne(newOrder);

        // Update product stock
        if (order.productId) {
          const productId = new ObjectId(order.productId);
          const product = await productsCollection.findOne({ _id: productId });

          if (product) {
            const newStock = Math.max(
              0,
              product.stock - Number(order.quantity),
            );
            await productsCollection.updateOne(
              { _id: productId },
              { $set: { stock: newStock } },
            );
          }
        }

        res.status(201).send({
          success: true,
          message: "Order placed successfully",
          insertedId: result.insertedId,
          order: newOrder,
        });
      } catch (err) {
        res.status(500).send({
          success: false,
          message: err.message,
        });
      }
    });

    // Get All Orders
    app.get("/orders", async (req, res) => {
      try {
        const {
          search = "",
          status,
          sort = "newest",
          page = 1,
          limit = 10,
        } = req.query;

        const query = {};

        // Search by product name or customer name
        if (search) {
          query.$or = [
            { productName: { $regex: search, $options: "i" } },
            { customerName: { $regex: search, $options: "i" } },
            { supplier: { $regex: search, $options: "i" } },
          ];
        }

        // Filter by status
        if (status && status !== "All") {
          query.status = status;
        }

        // Sorting
        let sortOption = {};
        switch (sort) {
          case "oldest":
            sortOption = { createdAt: 1 };
            break;
          case "amountLow":
            sortOption = { totalAmount: 1 };
            break;
          case "amountHigh":
            sortOption = { totalAmount: -1 };
            break;
          default:
            sortOption = { createdAt: -1 };
        }

        const skip = (Number(page) - 1) * Number(limit);
        const total = await ordersCollection.countDocuments(query);

        const orders = await ordersCollection
          .find(query)
          .sort(sortOption)
          .skip(skip)
          .limit(Number(limit))
          .toArray();

        res.send({
          success: true,
          total,
          currentPage: Number(page),
          totalPages: Math.ceil(total / Number(limit)),
          orders,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // Get Single Order
    app.get("/orders/:id", async (req, res) => {
      try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: "Invalid order ID format",
          });
        }

        const order = await ordersCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!order) {
          return res.status(404).send({
            success: false,
            message: "Order not found",
          });
        }

        res.send({
          success: true,
          data: order,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // Update Order Status
    app.put("/orders/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const { status } = req.body;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: "Invalid order ID format",
          });
        }

        if (!status) {
          return res.status(400).send({
            success: false,
            message: "Status is required",
          });
        }

        // Validate status
        const validStatuses = [
          "Pending",
          "Processing",
          "Shipped",
          "Delivered",
          "Cancelled",
        ];
        if (!validStatuses.includes(status)) {
          return res.status(400).send({
            success: false,
            message: `Invalid status. Valid statuses: ${validStatuses.join(", ")}`,
          });
        }

        const result = await ordersCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              status: status,
              updatedAt: new Date(),
            },
          },
        );

        if (result.matchedCount === 0) {
          return res.status(404).send({
            success: false,
            message: "Order not found",
          });
        }

        res.send({
          success: true,
          message: "Order status updated successfully",
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // Delete Order
    app.delete("/orders/:id", async (req, res) => {
      try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: "Invalid order ID format",
          });
        }

        // Check if order exists
        const order = await ordersCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!order) {
          return res.status(404).send({
            success: false,
            message: "Order not found",
          });
        }

        // Only allow deletion of Pending orders
        if (order.status !== "Pending") {
          return res.status(400).send({
            success: false,
            message: "Only pending orders can be deleted",
          });
        }

        // Restore product stock
        if (order.productId) {
          try {
            const productId = new ObjectId(order.productId);
            const product = await productsCollection.findOne({
              _id: productId,
            });

            if (product) {
              const newStock = product.stock + Number(order.quantity);
              await productsCollection.updateOne(
                { _id: productId },
                { $set: { stock: newStock } },
              );
            }
          } catch (err) {
            console.error("Error restoring stock:", err);
          }
        }

        const result = await ordersCollection.deleteOne({
          _id: new ObjectId(id),
        });

        res.send({
          success: true,
          message: "Order deleted successfully",
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // Get Order Statistics
    app.get("/orders/stats", async (req, res) => {
      try {
        const totalOrders = await ordersCollection.countDocuments();

        const pendingOrders = await ordersCollection.countDocuments({
          status: "Pending",
        });

        const completedOrders = await ordersCollection.countDocuments({
          status: { $in: ["Delivered", "Shipped"] },
        });

        const totalRevenue = await ordersCollection
          .aggregate([
            { $match: { status: { $in: ["Delivered", "Shipped"] } } },
            { $group: { _id: null, total: { $sum: "$totalAmount" } } },
          ])
          .toArray();

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayOrders = await ordersCollection.countDocuments({
          createdAt: { $gte: today },
        });

        res.send({
          success: true,
          stats: {
            totalOrders,
            pendingOrders,
            completedOrders,
            totalRevenue: totalRevenue[0]?.total || 0,
            todayOrders,
          },
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // Get Featured Products

    app.get("/products/featured", async (req, res) => {
      try {
        const products = await productsCollection
          .find({ status: "active" })
          .sort({ createdAt: -1 })
          .limit(3)
          .toArray();

        res.send({
          success: true,
          products,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // Get categories

    app.get("/products/categories", async (req, res) => {
      try {
        const categories = await productsCollection.distinct("category");

        res.send({
          success: true,
          categories,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // Get all suppliers - Query from usersCollection with role "supplier"
    app.get("/suppliers", async (req, res) => {
      try {
        const suppliers = await usersCollection
          .find({ role: "supplier" })
          .project({ password: 0 })
          .toArray();

        res.send({
          success: true,
          data: suppliers,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // Get Single Supplier
    app.get("/suppliers/:id", async (req, res) => {
      try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: "Invalid supplier ID format",
          });
        }

        const supplier = await usersCollection.findOne({
          _id: new ObjectId(id),
          role: "supplier",
        });

        if (!supplier) {
          return res.status(404).send({
            success: false,
            message: "Supplier not found",
          });
        }

        delete supplier.password;

        res.send({
          success: true,
          data: supplier,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // Get Single Product
    app.get("/products/:id", async (req, res) => {
      const id = req.params.id;

      const result = await productsCollection.findOne({
        _id: new ObjectId(id),
      });

      res.send(result);
    });

    // Update Product
    app.put("/products/:id", async (req, res) => {
      const id = req.params.id;
      const product = req.body;

      const query = {
        _id: new ObjectId(id),
      };

      const updateDoc = {
        $set: {
          productName: product.productName,
          sku: product.sku,
          category: product.category,
          supplier: product.supplier,
          purchasePrice: Number(product.purchasePrice),
          sellingPrice: Number(product.sellingPrice),
          stock: Number(product.stock),
          image: product.image,
          description: product.description,
          status: product.status,
        },
      };

      const result = await productsCollection.updateOne(query, updateDoc);

      res.send(result);
    });

    // Delete Product
    app.delete("/products/:id", async (req, res) => {
      const id = req.params.id;

      const result = await productsCollection.deleteOne({
        _id: new ObjectId(id),
      });

      res.send(result);
    });

    /*
     * ====================================
     * Users API (Admin)
     * ====================================
     */

    // Get All Users
    app.get("/users", async (req, res) => {
      try {
        const users = await usersCollection
          .find({})
          .project({ password: 0 })
          .toArray();

        res.send({
          success: true,
          data: users,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // Get Single User
    app.get("/users/:id", async (req, res) => {
      try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: "Invalid user ID format",
          });
        }

        const user = await usersCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!user) {
          return res.status(404).send({
            success: false,
            message: "User not found",
          });
        }

        delete user.password;

        res.send({
          success: true,
          data: user,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // Update User
    app.put("/users/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const userData = req.body;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: "Invalid user ID format",
          });
        }

        const existingUser = await usersCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!existingUser) {
          return res.status(404).send({
            success: false,
            message: "User not found",
          });
        }

        const updateFields = {};

        const allowedFields = [
          "name",
          "email",
          "role",
          "emailVerified",
          "image",
          "phone",
          "address",
        ];

        allowedFields.forEach((field) => {
          if (userData[field] !== undefined) {
            updateFields[field] = userData[field];
          }
        });

        if (userData.password) {
          updateFields.password = userData.password;
        }

        updateFields.updatedAt = new Date();

        const result = await usersCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateFields },
        );

        if (result.matchedCount === 0) {
          return res.status(404).send({
            success: false,
            message: "User not found",
          });
        }

        if (result.modifiedCount === 0) {
          return res.status(400).send({
            success: false,
            message: "No changes were made to the user",
          });
        }

        const updatedUser = await usersCollection.findOne({
          _id: new ObjectId(id),
        });
        delete updatedUser.password;

        res.send({
          success: true,
          message: "User updated successfully",
          data: updatedUser,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // Delete User
    app.delete("/users/:id", async (req, res) => {
      try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: "Invalid user ID format",
          });
        }

        const user = await usersCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!user) {
          return res.status(404).send({
            success: false,
            message: "User not found",
          });
        }

        if (user.role === "admin") {
          return res.status(403).send({
            success: false,
            message: "Cannot delete admin users",
          });
        }

        const result = await usersCollection.deleteOne({
          _id: new ObjectId(id),
        });

        if (result.deletedCount === 0) {
          return res.status(400).send({
            success: false,
            message: "Failed to delete user",
          });
        }

        res.send({
          success: true,
          message: "User deleted successfully",
          deletedId: id,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // Monthly Revenue Chart
    app.get("/reports/revenue", async (req, res) => {
      try {
        const result = await ordersCollection
          .aggregate([
            {
              $match: {
                status: {
                  $in: ["Delivered", "Shipped"],
                },
              },
            },
            {
              $group: {
                _id: {
                  month: {
                    $month: "$createdAt",
                  },
                },
                revenue: {
                  $sum: "$totalAmount",
                },
              },
            },
            {
              $sort: {
                "_id.month": 1,
              },
            },
          ])
          .toArray();

        const months = [
          "",
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ];

        const data = result.map((item) => ({
          month: months[item._id.month],
          revenue: item.revenue,
        }));

        res.send({
          success: true,
          data,
        });
      } catch (err) {
        res.status(500).send({
          success: false,
          message: err.message,
        });
      }
    });

    // Top Selling Products
    app.get("/reports/top-products", async (req, res) => {
      try {
        const result = await ordersCollection
          .aggregate([
            {
              $group: {
                _id: "$productName",
                sold: {
                  $sum: "$quantity",
                },
                revenue: {
                  $sum: "$totalAmount",
                },
              },
            },
            {
              $sort: {
                sold: -1,
              },
            },
            {
              $limit: 5,
            },
          ])
          .toArray();

        res.send({
          success: true,
          data: result,
        });
      } catch (err) {
        res.status(500).send({
          success: false,
          message: err.message,
        });
      }
    });

    // Low Stock Products
    app.get("/reports/low-stock", async (req, res) => {
      try {
        const products = await productsCollection
          .find({
            stock: {
              $lte: 5,
            },
          })
          .sort({
            stock: 1,
          })
          .toArray();

        res.send({
          success: true,
          data: products,
        });
      } catch (err) {
        res.status(500).send({
          success: false,
          message: err.message,
        });
      }
    });

    // Recent Orders
    app.get("/reports/recent-orders", async (req, res) => {
      try {
        const orders = await ordersCollection
          .find()
          .sort({
            createdAt: -1,
          })
          .limit(10)
          .toArray();

        res.send({
          success: true,
          data: orders,
        });
      } catch (err) {
        res.status(500).send({
          success: false,
          message: err.message,
        });
      }
    });

    // Recent Purchases
    app.get("/reports/recent-purchases", async (req, res) => {
      try {
        const purchases = await purchasesCollection
          .find()
          .sort({
            createdAt: -1,
          })
          .limit(10)
          .toArray();

        res.send({
          success: true,
          data: purchases,
        });
      } catch (err) {
        res.status(500).send({
          success: false,
          message: err.message,
        });
      }
    });

    // Inventory Report
    app.get("/reports/inventory", async (req, res) => {
      try {
        const products = await productsCollection
          .find()
          .project({
            productName: 1,
            category: 1,
            supplier: 1,
            stock: 1,
            sellingPrice: 1,
          })
          .toArray();

        res.send({
          success: true,
          data: products,
        });
      } catch (err) {
        res.status(500).send({
          success: false,
          message: err.message,
        });
      }
    });

    // Report Statistics
    app.get("/reports/stats", async (req, res) => {
      try {
        const pendingOrders = await ordersCollection.countDocuments({
          status: "Pending",
        });

        const lowStock = await productsCollection.countDocuments({
          stock: {
            $lte: 5,
          },
        });

        const outOfStock = await productsCollection.countDocuments({
          stock: 0,
        });

        const totalStock = await productsCollection
          .aggregate([
            {
              $group: {
                _id: null,
                total: {
                  $sum: "$stock",
                },
              },
            },
          ])
          .toArray();

        res.send({
          success: true,
          data: {
            pendingOrders,
            lowStock,
            outOfStock,
            totalStock: totalStock[0]?.total || 0,
          },
        });
      } catch (err) {
        res.status(500).send({
          success: false,
          message: err.message,
        });
      }
    });

    // Dashboard Summary
    app.get("/reports/dashboard", async (req, res) => {
      try {
        const [
          totalProducts,
          totalOrders,
          totalPurchases,
          totalCustomers,
          totalSuppliers,
        ] = await Promise.all([
          productsCollection.countDocuments(),
          ordersCollection.countDocuments(),
          purchasesCollection.countDocuments(),
          usersCollection.countDocuments({ role: "customer" }),
          usersCollection.countDocuments({ role: "supplier" }),
        ]);

        const revenue = await ordersCollection
          .aggregate([
            {
              $match: {
                status: {
                  $in: ["Delivered", "Shipped"],
                },
              },
            },
            {
              $group: {
                _id: null,
                total: {
                  $sum: "$totalAmount",
                },
              },
            },
          ])
          .toArray();

        res.send({
          success: true,
          data: {
            totalProducts,
            totalOrders,
            totalPurchases,
            totalCustomers,
            totalSuppliers,
            totalRevenue: revenue[0]?.total || 0,
          },
        });
      } catch (err) {
        res.status(500).send({
          success: false,
          message: err.message,
        });
      }
    });

    // Bulk Delete Users
    app.delete("/users/bulk", async (req, res) => {
      try {
        const { userIds } = req.body;

        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
          return res.status(400).send({
            success: false,
            message: "Please provide an array of user IDs to delete",
          });
        }

        const objectIds = userIds
          .filter((id) => ObjectId.isValid(id))
          .map((id) => new ObjectId(id));

        if (objectIds.length === 0) {
          return res.status(400).send({
            success: false,
            message: "No valid user IDs provided",
          });
        }

        const usersToDelete = await usersCollection
          .find({ _id: { $in: objectIds } })
          .toArray();

        const adminUsers = usersToDelete.filter(
          (user) => user.role === "admin",
        );

        if (adminUsers.length > 0) {
          return res.status(403).send({
            success: false,
            message: "Cannot delete admin users",
            adminUserIds: adminUsers.map((u) => u._id),
          });
        }

        const result = await usersCollection.deleteMany({
          _id: { $in: objectIds },
        });

        res.send({
          success: true,
          message: `${result.deletedCount} users deleted successfully`,
          deletedCount: result.deletedCount,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // Get Users by Role
    app.get("/users/role/:role", async (req, res) => {
      try {
        const role = req.params.role;

        const validRoles = ["admin", "customer", "supplier"];
        if (!validRoles.includes(role)) {
          return res.status(400).send({
            success: false,
            message: "Invalid role. Valid roles are: admin, customer, supplier",
          });
        }

        const users = await usersCollection
          .find({ role: role })
          .project({ password: 0 })
          .toArray();

        res.send({
          success: true,
          data: users,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Mini ERP Server Running");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
