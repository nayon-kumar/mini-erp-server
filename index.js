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
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // await client.connect();

    const db = client.db("mini-erp");

    const productsCollection = db.collection("products");
    const customersCollection = db.collection("customers");
    const suppliersCollection = db.collection("suppliers");
    const purchasesCollection = db.collection("purchases");
    const salesCollection = db.collection("sales");

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

    // Get All Products
    app.get("/products", async (req, res) => {
      const result = await productsCollection.find().toArray();
      res.send(result);
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
