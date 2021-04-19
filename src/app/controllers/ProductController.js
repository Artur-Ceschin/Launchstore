const Category = require('../model/Category')
const Product = require('../model/Product')
const File = require('../model/File')
const { formatPrice, date } = require('../../lib/utils')

module.exports = {

    async create(req, res) {
        //Push Categories
        const results = await Category.all()
        const categories = results.rows

        return res.render('products/create.njk', { categories })

    },
    async post(req, res) {
        //Validation 
        const keys = Object.keys(req.body)

        for (key in keys) {
            if (req.body[key] == '') {
                return res.send("Please fill all required fields")
            }
        }

        if (req.files.length == 0) {
            return res.send("Please send at least one image")
        }

        let results = await Product.create(req.body)
        const productId = results.rows[0].id


        const filesPromise = req.files.map(file => File.create({ ...file, product_id: productId }))
        await Promise.all(filesPromise)

        return res.redirect(`/products/${productId}/edit`)

    },
    async show(req, res) {
        let results = await Product.find(req.params.id)
        const product = results.rows[0]

        if (!product) return res.send('Product not found')

        const { day, month, hour, minutes } = date(product.updated_at)

        product.published = {
            day: `${day}/${month}`,
            hour: `${hour}h${minutes}`
        }

        product.oldPrice = formatPrice(product.old_price)
        product.price = formatPrice(product.price)

        results = await Product.files(product.id)
        let files = results.rows.map(file => ({
            ...file,
            src: `${req.protocol}://${req.headers.host}${file.path.replace("public", "")}`
        }))

        return res.render("products/show", { product, files })
    },
    async edit(req, res) {

        let results = await Product.find(req.params.id)
        const product = results.rows[0]

        if (!product) return res.send('Product not found')

        product.price = formatPrice(product.price)
        product.old_price = formatPrice(product.old_price)

        //get Categories
        results = await Category.all()
        const categories = results.rows

        //get Images
        results = await Product.files(product.id)
        let files = results.rows
        files = files.map(file => ({
            ...file,
            src: `${req.protocol}://${req.headers.host}${file.path.replace("public", "")}`
        }))

        return res.render('products/edit.njk', { product, categories, files })
    },
    async put(req, res) {
        //Validation 
        const keys = Object.keys(req.body)

        for (key in keys) {
            if (req.body[key] == '' && key != 'removed_files') {
                return res.send("Please fill all required fields")
            }
        }

        if (req.files.length != 0) {
            const newFilesPromise = req.files.map(file =>
                File.create({ ...file, product_id: req.body.id }))
            await Promise.all(newFilesPromise)
        }


        if (req.body.removed_files) {
            const removedFiles = req.body.removed_files.split(',')
            const lasIndex = removedFiles.length - 1
            removedFiles.splice(lasIndex, 1)

            const removedFilesPromise = removedFiles.map(id => File.delete(id))

            await Promise.all(removedFilesPromise)
        }

        req.body.price = req.body.price.replace(/\D/g, '')

        if (req.body.old_price != req.body.price) {
            const oldPrice = await Product.find(req.body.id)
            req.body.old_price = oldPrice.rows[0].price
        }

        await Product.update(req.body)

        return res.redirect(`/products/${req.body.id}`)

    },
    async delete(req, res) {
        await Product.delete(req.body.id)

        return res.redirect('/products/create')
    }

}