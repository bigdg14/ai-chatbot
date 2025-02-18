import { Pool } from "pg";
import * as dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config({ path: __dirname + "/.env" });

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "products", // Replace with your database name
  password: "admin", // Replace with your password
  port: 5432,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method === "GET") {
    try {
      console.log("Fetching all products...");

      // Fetch all products from the database
      const dbResponse = await pool.query(
        "SELECT id, name, description FROM products.products"
      );
      const products = dbResponse.rows;

      console.log("Fetched products:", products);
      res.status(200).json({ products });
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ error: "Failed to fetch products." });
    }
  } else if (req.method === "POST") {
    try {
      const { prompt } = req.body;

      if (!prompt || prompt.trim().length === 0) {
        res
          .status(400)
          .json({ message: "Invalid input. Please provide a valid prompt." });
        return;
      }

      console.log("Received prompt:", prompt);

      // Step 1: Generate the SQL query using GPT
      const gptResponse = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `You are an assistant that converts natural language queries into SQL for a PostgreSQL database with the following schema:
            - Table: products.products
              - Columns: id, name, description`,
          },
          { role: "user", content: `Only generate 1 SQL query. If the message is unclear, choose the best query from the info provided. Generate a SQL query for: "${prompt}"` },
        ],
        temperature: 0,
        max_tokens: 100,
      });

      const sqlQuery = gptResponse.choices[0].message.content.trim();
      console.log("Generated SQL Query:", sqlQuery);

      // Step 2: Execute the generated SQL query
      const dbResponse = await pool.query(sqlQuery + '.products');
      const results = dbResponse.rows;

      console.log("Query Execution Results:", results);

      // Step 3: Generate a user-friendly message using GPT
      const friendlyResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a helpful assistant. Format database query results into a user-friendly message. Examples:
            - Input: [{ "count": "50" }]
            - Output: There are 50 products available.
            - Input: [{ "id": 1, "name": "Product A", "description": Data on housing prices, sales, and market conditions }]
            - Output: The 1st product is Product A, which is described as data on housing prices, sales, and market conditions.`,
          },
          {
            role: "user",
            content: `User query: "${prompt}". Raw database results: ${JSON.stringify(
              results
            )}. Format this into a user-friendly response.`,
          },
        ],
        temperature: 0.7,
        max_tokens: 150,
      });

      const responseMessage =
        friendlyResponse.choices[0].message.content.trim();
      console.log("Friendly Response Message:", responseMessage);

      res
        .status(200)
        .json({ query: sqlQuery, message: responseMessage, results });
    } catch (error) {
      console.error("Error processing request:", error);
      res.status(500).json({ message: "Error processing the request." });
    }
  } else {
    res.setHeader("Allow", ["GET", "POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
