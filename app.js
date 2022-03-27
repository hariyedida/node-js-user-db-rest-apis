const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const cors = require("cors");
const dbPath = path.join(__dirname, "saguna_users_db.db");

const app = express();
app.use(express.json());
app.use(cors());

let db = null;
let port;

const initializeDbAndServer = async () => {
	try {
		db = await open({
			filename: dbPath,
			driver: sqlite3.Database,
		});
		port = process.env.PORT || 9000;
		app.listen(port, () =>
			console.log(`server Running at http://localhost:${port}/`)
		);
	} catch (error) {
		console.log(`DB Error: ${error.message}`);
		process.exit(1);
	}
};

initializeDbAndServer();

app.get("/", (req, res) => {
	res.status(200);
	res.send("Running");
});

app.get("/specializations", async (req, res) => {
	let data = null;
	const dataQuery = `SELECT * FROM specialization_master`;
	data = await db.all(dataQuery);
	res.status(200);
	res.json({ specialization: data });
});

app.get("/users", async (req, res) => {
	const { search } = req.query;
	let data = null;
	const dataQuery = `SELECT associates_master.associate_id,associate_name,phone,address,group_concat(specialization_name) AS specialization FROM associates_master JOIN associate_specialization ON associates_master.associate_id = associate_specialization.associate_id JOIN specialization_master ON specialization_master.specialization_id = associate_specialization.specialization_id GROUP BY associates_master.associate_id HAVING associate_name LIKE '%${search}%';`;
	data = await db.all(dataQuery);
	res.status(200);
	res.json({ userData: data });
});

app.get("/user-details/:id", async (req, res) => {
	const { id } = req.params;
	let userData = null;
	try {
		const dataQuery = `SELECT associate_name,phone,address, group_concat(specialization_name) AS specialization FROM associates_master JOIN associate_specialization ON associates_master.associate_id = associate_specialization.associate_id JOIN specialization_master ON specialization_master.specialization_id = associate_specialization.specialization_id WHERE associates_master.associate_id=${id}`;
		userData = await db.all(dataQuery);
	} catch (error) {}
	if (userData.length > 0) {
		res.status(200);
		res.json({ userData });
	} else {
		res.status(204);
	}
});

app.post("/add-user", async (req, res) => {
	const { userData } = req.body;
	const { specialization_name, associate_name, phone, address } = userData;
	const associates_master_query = `INSERT INTO associates_master (associate_name, phone, address) VALUES('${associate_name}',${phone},' ${address}' );`;
	const associates_master_res = await db.run(associates_master_query);
	const { lastID } = associates_master_res;
	const specialization_ids_list = [];
	for (let i of specialization_name) {
		specialization_ids_list.push({ i: i, associate_id: lastID });
	}
	const insertValues = specialization_ids_list.map(
		(eachValue) => `(${eachValue.i},${eachValue.associate_id})`
	);
	const modifiedValues = insertValues.join(",");
	const associate_specialization_Query = `INSERT INTO associate_specialization (specialization_id,associate_id) VALUES ${modifiedValues};`;
	const associates_specialization_res = await db.run(
		associate_specialization_Query
	);
	res.status(200);
	res.json({ associates_master_res });
});

app.put("/update-user/:id", async (req, res) => {
	const { id } = req.params;
	const { userData } = req.body;
	const { specialization_name, associate_name, phone, address } = userData;
	const delete_previous_specializations = `DELETE FROM associate_specialization WHERE associate_id = ${id}`;
	const delete_res = await db.run(delete_previous_specializations);
	const associates_master_query = `UPDATE associates_master SET associate_name = '${associate_name}', phone=${phone}, address=' ${address}' WHERE associate_id=${id};`;
	const associates_master_res = await db.run(associates_master_query);
	const lastID = id;
	const specialization_ids_list = [];
	for (let i of specialization_name) {
		specialization_ids_list.push({ associate_id: lastID, i: i });
	}
	const insertValues = specialization_ids_list.map(
		(eachValue) => `(${eachValue.i},${eachValue.associate_id})`
	);
	const modifiedValues = insertValues.join(",");

	const associate_specialization_Query = `INSERT INTO associate_specialization (specialization_id,associate_id) VALUES ${modifiedValues};`;
	const associates_specialization_res = await db.run(
		associate_specialization_Query
	);
	res.status(200);
	res.send("Data updated");
});

app.delete("/delete-user", async (req, res) => {
	const { deleteIds } = req.body;
	const str = deleteIds.join(",");
	const delete_associate_Query = `DELETE FROM associates_master WHERE associate_id IN (${str})`;
	const delete_specialization_Query = `DELETE FROM associate_specialization WHERE associate_id IN (${str})`;
	await db.run(delete_associate_Query);
	await db.run(delete_specialization_Query);
	res.send("user deleted");
	res.status(200);
});
