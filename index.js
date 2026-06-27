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
    // Remove this line - no suppliers collection
    // const suppliersCollection = db.collection("suppliers");
    const purchasesCollection = db.collection("purchases");
    const salesCollection = db.collection("sales");
    const usersCollection = db.collection("user");

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

    // Buy Product
    app.post("/orders", async (req, res) => {
      try {
        const order = req.body;

        order.createdAt = new Date();
        order.status = "Pending";

        const result = await db.collection("orders").insertOne(order);

        res.status(201).send({
          success: true,
          insertedId: result.insertedId,
        });
      } catch (err) {
        res.status(500).send({
          success: false,
          message: err.message,
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

    // Get all suppliers - FIXED: Query from usersCollection with role "supplier"
    app.get("/suppliers", async (req, res) => {
      try {
        const suppliers = await usersCollection
          .find({ role: "supplier" })
          .project({ password: 0 }) // Exclude password for security
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

    // Get Single Supplier - NEW endpoint for getting individual supplier
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

        // Remove password from response
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
          .project({ password: 0 }) // Exclude password if it exists
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

        // Remove password from response if it exists
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

        // Check if user exists
        const existingUser = await usersCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!existingUser) {
          return res.status(404).send({
            success: false,
            message: "User not found",
          });
        }

        // Build update object - only include fields that are provided
        const updateFields = {};

        // Fields that can be updated based on your schema
        const allowedFields = [
          "name",
          "email",
          "role",
          "emailVerified",
          "image", // Add if you have profile image
          "phone", // Add if you have phone field
          "address", // Add if you have address field
        ];

        // Add fields that exist in the request body
        allowedFields.forEach((field) => {
          if (userData[field] !== undefined) {
            updateFields[field] = userData[field];
          }
        });

        // Handle password separately if it's provided
        if (userData.password) {
          // In production, you should hash the password before storing
          // For demo, we'll just store it directly (not recommended for production)
          updateFields.password = userData.password;
        }

        // Add updated timestamp
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

        // Get the updated user
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

        // Check if user exists
        const user = await usersCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!user) {
          return res.status(404).send({
            success: false,
            message: "User not found",
          });
        }

        // Prevent deleting admin users
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

    // Bulk Delete Users (Optional)
    app.delete("/users/bulk", async (req, res) => {
      try {
        const { userIds } = req.body;

        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
          return res.status(400).send({
            success: false,
            message: "Please provide an array of user IDs to delete",
          });
        }

        // Convert string IDs to ObjectId
        const objectIds = userIds
          .filter((id) => ObjectId.isValid(id))
          .map((id) => new ObjectId(id));

        if (objectIds.length === 0) {
          return res.status(400).send({
            success: false,
            message: "No valid user IDs provided",
          });
        }

        // Prevent deleting admin users
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

    // Get Users by Role (Utility endpoint)
    app.get("/users/role/:role", async (req, res) => {
      try {
        const role = req.params.role;

        // Validate role
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
