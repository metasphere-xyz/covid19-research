# Render

This is a folder for a command-line tool that renders landforms without a browser.
The command creates landforms and outputs a JSON file that contains calculated coordinates of clusters, subclusters, papers and probability contours.
By using the output JSON file, the frontend application can skip arrangement of landforms.
That will improve the speed of the frontend application.

## Prerequisites

You need the following software installed,
- [Node.js](https://nodejs.org/en/) version 12.x or higher

## Building the command

Please take the following steps,

1. Move to this folder.

2. Install Node modules.

    ```
    npm ci
    ```

3. Run the `build` script with `npm`.

    ```
    npm run build
    ```

4. You will find a `index.js` script in a `dist` folder.

## Running the command

Before running the command, please finish the steps in the section [Building the command](#building-the-command).

By running the following command,

```
npm start -- -h
```

It will show messages similar to the following,

```
Usage: prerender [options] <data> <out>

Options:
  -V, --version  output the version number
  -h, --help     display help for command
```

The command takes the following positional arguments,

1. `data`

   Path to an input JSON file containing cluster information.

2. `out`

   Path to an output JSON file where pre-rendered coordinates are to be saved.


Here is an example.

```
npm start -- input.json output.json
```

## Output JSON structure

The structure of an output JSON file is shown below as an equivalent JavaScript object with example values.

```js
[
    // array of clusters
    {
        topicId: 1, // topic ID of this cluster
        x: 0.14397892855168884, // center of this cluster in a domain [-0.5, 0.5]
        y: 0.18935082774405496, // center of this cluster in a domain [-0.5, 0.5]
        size: 0.0758342654069177, // radius of this cluster
        numPapers: 2477, // number of papers in this cluster
        // array of subclusters in this cluster
        subclusters: [
            {
                topicId: 1, // topic ID of this subcluster
                x: -0.11967420440637258, // center of this subcluster in a domain [-0.5, 0.5]
                y: -0.19517664148886832, // center of this subcluster in a domain [-0.5, 0.5]
                size: 0.08390331248396089, // radius of this subcluster
                numPapers: 279, // number of papers in this subcluster
                // array of papers in this subcluster
                papers: [
                    {
                        prob: 0.2819, // probability of this paper contained in the subcluster (?)
                        x: 0.12701737873157576, // center of this paper in a domain [-0.5, 0.5]
                        y: 0.00988538632014025, // center of this paper in a domain [-0.5, 0.5]
                        r: 0.01, // radius of this paper
                        paper_id: "0015023cc06b5362d332b3baf348d11567ca2fbb", // SHA256 hash of this paper
                        title: "The RNA pseudoknots in foot-and-mouth disease virus are dispensable for genome replication but essential for the production of infectious virus. 2 3" // title of this paper
                    }, // ...
                ]
            }, // ...
        ],
        // probability contours
        probabilityContours: {
            innerPadding: 0.2, // padding used to distribute papers inside the subcluster
            numGridRows: 80, // number of grid rows used to calculate probability contours
            numGridColumns: 80, // number of grid columns used to calculate probability contours
            // array of probability contours
            contours: [
                // an object created by d3.contours#contour
                // it can be supplied to d3.geoPath
                {
                    type: "MultiPolygon",
                    value: 0.1, // probability corresponding to this contour
                    coordinates: [
                        [
                            [
                                [
                                    31.918604651162788,
                                    29.5
                                ], // ...
                            ]
                        ], // ...
                    ]
                }, // ...
            ]
        }
    }, // ...
]
```